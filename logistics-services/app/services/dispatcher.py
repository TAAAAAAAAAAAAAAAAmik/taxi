import asyncio
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from math import inf
from time import monotonic
from uuid import uuid4

from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.node_client import NodeBackendClient, NodeBackendError
from app.models import DispatchEvent
from app.schemas import DispatchMode, GeoPoint
from app.services.driver_geo import DriverCandidate, DriverGeoService

try:
    from scipy.optimize import linear_sum_assignment
except Exception:  # pragma: no cover
    linear_sum_assignment = None


@dataclass(frozen=True)
class DispatchOrder:
    """Order payload that is ready for dispatch."""

    order_id: str
    pickup: GeoPoint
    payload: dict


@dataclass(frozen=True)
class DispatchResult:
    """Dispatch attempt result."""

    order_id: str
    status: str
    driver_id: str | None = None
    batch_id: str | None = None


class DispatcherService:
    """Greedy and batched order dispatch over Redis GEO and Node callbacks."""

    def __init__(
        self,
        redis: Redis,
        session: AsyncSession | None,
        node_client: NodeBackendClient,
        settings: Settings | None = None,
        driver_geo: DriverGeoService | None = None,
    ) -> None:
        self.redis = redis
        self.session = session
        self.node = node_client
        self.settings = settings or get_settings()
        self.driver_geo = driver_geo or DriverGeoService(redis)

    async def enqueue_order(
        self,
        order_id: str,
        pickup: GeoPoint,
        payload: dict,
        mode: DispatchMode | None = None,
    ) -> str:
        """Push a pending order into Redis Streams for async processing."""

        stream_id = await self.redis.xadd(
            self.settings.dispatch_stream,
            {
                "mode": mode or self.settings.dispatch_mode,
                "order": json.dumps(payload, ensure_ascii=False),
                "order_id": order_id,
                "pickup_latitude": str(pickup.latitude),
                "pickup_longitude": str(pickup.longitude),
            },
        )
        await self.record_event(
            order_id=order_id,
            event_type="order_enqueued",
            payload={"stream_id": stream_id, "mode": mode or self.settings.dispatch_mode},
            idempotency_key=f"dispatch:enqueue:{order_id}:{stream_id}",
        )
        return str(stream_id)

    async def dispatch_greedy(self, order: DispatchOrder) -> DispatchResult:
        """Offer an order to nearest drivers one by one until accepted or exhausted."""

        lock_key = f"dispatch:order:{order.order_id}:lock"
        if not await self.redis.set(lock_key, "1", nx=True, ex=180):
            await self.record_event(order.order_id, "dispatch_duplicate_skipped")
            return DispatchResult(order_id=order.order_id, status="duplicate_skipped")

        try:
            await self.record_event(order.order_id, "greedy_started", payload=order.payload)
            candidates = await self.driver_geo.nearby_free_drivers(
                latitude=order.pickup.latitude,
                longitude=order.pickup.longitude,
                radius_meters=self.settings.default_search_radius_meters,
                limit=25,
            )
            if not candidates:
                await self.record_event(order.order_id, "no_driver_found")
                return DispatchResult(order_id=order.order_id, status="no_driver_found")

            for candidate in candidates:
                result = await self._offer_and_assign(order, candidate)
                if result.status in {"assigned", "already_assigned"}:
                    return result

            await self.record_event(order.order_id, "no_driver_accepted")
            return DispatchResult(order_id=order.order_id, status="no_driver_accepted")
        finally:
            await self.redis.delete(lock_key)

    async def dispatch_batch(self, orders: list[DispatchOrder]) -> list[DispatchResult]:
        """Assign a batch of orders to drivers using the Hungarian algorithm."""

        batch_id = f"batch_{uuid4().hex}"
        await asyncio.sleep(self.settings.batch_window_seconds)
        candidate_lists = await asyncio.gather(
            *[
                self.driver_geo.nearby_free_drivers(
                    latitude=order.pickup.latitude,
                    longitude=order.pickup.longitude,
                    radius_meters=self.settings.default_search_radius_meters,
                    limit=50,
                )
                for order in orders
            ],
        )
        drivers = self._unique_drivers(candidate_lists)
        if not drivers:
            for order in orders:
                await self.record_event(order.order_id, "batch_no_driver_found", batch_id=batch_id)
            return [
                DispatchResult(order_id=order.order_id, status="no_driver_found", batch_id=batch_id)
                for order in orders
            ]

        matrix = self._cost_matrix(candidate_lists, drivers)
        assignments = self._solve_assignment(matrix)
        tasks = []
        assigned_orders: set[int] = set()

        for row_idx, column_idx in assignments:
            if row_idx >= len(orders) or column_idx >= len(drivers):
                continue
            if matrix[row_idx][column_idx] == inf:
                continue
            assigned_orders.add(row_idx)
            tasks.append(self._offer_and_assign(orders[row_idx], drivers[column_idx], batch_id=batch_id))

        results = list(await asyncio.gather(*tasks)) if tasks else []
        for idx, order in enumerate(orders):
            if idx not in assigned_orders:
                await self.record_event(order.order_id, "batch_unassigned", batch_id=batch_id)
                results.append(DispatchResult(order_id=order.order_id, status="unassigned", batch_id=batch_id))
        return results

    async def publish_driver_response(
        self,
        order_id: str,
        driver_id: str,
        decision: str,
        reason: str | None = None,
        offer_id: str | None = None,
    ) -> str:
        """Publish a driver offer answer into the per-order response stream."""

        return str(
            await self.redis.xadd(
                self._offer_response_stream(order_id),
                {
                    "decision": decision,
                    "driver_id": driver_id,
                    "offer_id": offer_id or "",
                    "reason": reason or "",
                },
            ),
        )

    async def _offer_and_assign(
        self,
        order: DispatchOrder,
        candidate: DriverCandidate,
        batch_id: str | None = None,
    ) -> DispatchResult:
        offer_id = f"offer_{uuid4().hex}"
        payload = {
            "batchId": batch_id,
            "distanceMeters": candidate.distance_meters,
            "expiresInSeconds": self.settings.driver_offer_timeout_seconds,
            "fulfilledByRole": "park_driver" if candidate.park_id else "self_employed",
            "offerId": offer_id,
            "order": order.payload,
            "parkId": candidate.park_id,
        }

        try:
            await self.node.send_driver_offer(order.order_id, candidate.driver_id, payload)
        except NodeBackendError as error:
            await self.redis.xadd(
                "driver_offers",
                {
                    "driver_id": candidate.driver_id,
                    "error": str(error),
                    "offer": json.dumps(payload, ensure_ascii=False),
                    "order_id": order.order_id,
                },
            )

        await self.record_event(
            order_id=order.order_id,
            event_type="offer_sent",
            driver_id=candidate.driver_id,
            batch_id=batch_id,
            payload=payload,
            idempotency_key=f"dispatch:offer:{offer_id}",
        )

        decision = await self._wait_for_driver_decision(order.order_id, candidate.driver_id, offer_id)
        if decision != "accepted":
            await self.record_event(
                order_id=order.order_id,
                event_type="offer_rejected" if decision == "rejected" else "offer_timeout",
                driver_id=candidate.driver_id,
                batch_id=batch_id,
                payload={"decision": decision, "offer_id": offer_id},
            )
            return DispatchResult(order_id=order.order_id, status=decision, driver_id=candidate.driver_id, batch_id=batch_id)

        try:
            await self.node.assign_order(
                order.order_id,
                candidate.driver_id,
                park_id=candidate.park_id,
                fulfilled_by_role="park_driver" if candidate.park_id else "self_employed",
                batch_id=batch_id,
            )
            await self.driver_geo.mark_status(candidate.driver_id, "busy")
            await self.record_event(
                order_id=order.order_id,
                event_type="assigned",
                driver_id=candidate.driver_id,
                batch_id=batch_id,
                payload={"offer_id": offer_id},
                idempotency_key=f"dispatch:assigned:{order.order_id}",
            )
            return DispatchResult(order_id=order.order_id, status="assigned", driver_id=candidate.driver_id, batch_id=batch_id)
        except NodeBackendError as error:
            event_type = "already_assigned" if "already" in str(error).lower() else "assign_failed"
            await self.record_event(
                order_id=order.order_id,
                event_type=event_type,
                driver_id=candidate.driver_id,
                batch_id=batch_id,
                payload={"error": str(error), "offer_id": offer_id},
            )
            return DispatchResult(order_id=order.order_id, status=event_type, driver_id=candidate.driver_id, batch_id=batch_id)

    async def _wait_for_driver_decision(self, order_id: str, driver_id: str, offer_id: str) -> str:
        deadline = monotonic() + self.settings.driver_offer_timeout_seconds
        stream = self._offer_response_stream(order_id)
        last_id = "$"

        while monotonic() < deadline:
            block_ms = max(1, int((deadline - monotonic()) * 1000))
            items = await self.redis.xread({stream: last_id}, block=block_ms, count=10)
            for _, messages in items or []:
                for message_id, fields in messages:
                    last_id = message_id
                    if fields.get("driver_id") != driver_id:
                        continue
                    if fields.get("offer_id") and fields.get("offer_id") != offer_id:
                        continue
                    return fields.get("decision") or "rejected"

        return "timeout"

    async def record_event(
        self,
        order_id: str,
        event_type: str,
        driver_id: str | None = None,
        batch_id: str | None = None,
        payload: dict | None = None,
        idempotency_key: str | None = None,
    ) -> None:
        """Persist a dispatch event when a DB session is available."""

        if not self.session:
            return

        if idempotency_key:
            existing = await self.session.scalar(
                select(DispatchEvent).where(DispatchEvent.idempotency_key == idempotency_key),
            )
            if existing:
                return

        self.session.add(
            DispatchEvent(
                batch_id=batch_id,
                created_at=datetime.now(timezone.utc),
                driver_id=driver_id,
                event_type=event_type,
                idempotency_key=idempotency_key,
                order_id=order_id,
                payload=payload or {},
            ),
        )
        try:
            await self.session.commit()
        except IntegrityError:
            await self.session.rollback()

    @staticmethod
    def _unique_drivers(candidate_lists: list[list[DriverCandidate]]) -> list[DriverCandidate]:
        by_id: dict[str, DriverCandidate] = {}
        for candidates in candidate_lists:
            for candidate in candidates:
                existing = by_id.get(candidate.driver_id)
                if not existing or candidate.distance_meters < existing.distance_meters:
                    by_id[candidate.driver_id] = candidate
        return list(by_id.values())

    @staticmethod
    def _cost_matrix(candidate_lists: list[list[DriverCandidate]], drivers: list[DriverCandidate]) -> list[list[float]]:
        matrix: list[list[float]] = []
        for candidates in candidate_lists:
            distances = {candidate.driver_id: candidate.distance_meters for candidate in candidates}
            matrix.append([distances.get(driver.driver_id, inf) for driver in drivers])
        return matrix

    @staticmethod
    def _solve_assignment(matrix: list[list[float]]) -> list[tuple[int, int]]:
        if not matrix:
            return []

        if linear_sum_assignment:
            rows, cols = linear_sum_assignment(matrix)
            return [(int(row), int(col)) for row, col in zip(rows, cols, strict=True)]

        used_cols: set[int] = set()
        assignments: list[tuple[int, int]] = []
        for row_idx, row in enumerate(matrix):
            best_col = min(
                (idx for idx in range(len(row)) if idx not in used_cols),
                key=lambda idx: row[idx],
                default=-1,
            )
            if best_col >= 0:
                used_cols.add(best_col)
                assignments.append((row_idx, best_col))
        return assignments

    @staticmethod
    def _offer_response_stream(order_id: str) -> str:
        return f"driver_offer_responses:{order_id}"
