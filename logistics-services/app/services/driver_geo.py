from dataclasses import dataclass
from datetime import datetime, timezone

from redis.asyncio import Redis

from app.schemas import DriverAvailabilityStatus, DriverLocationRequest, NearbyDriver


@dataclass(frozen=True)
class DriverCandidate:
    """Internal dispatch candidate from Redis GEO."""

    driver_id: str
    distance_meters: float
    latitude: float
    longitude: float
    status: DriverAvailabilityStatus
    driver_role: str = "self_employed_driver"
    park_id: str | None = None


class DriverGeoService:
    """Maintain driver Redis GEO indexes and search nearest free drivers."""

    all_geo_key = "drivers:geo:all"
    free_geo_key = "drivers:geo:free"

    def __init__(self, redis: Redis) -> None:
        self.redis = redis

    async def update_location(self, driver_id: str, payload: DriverLocationRequest) -> bool:
        """Update driver coordinates and free/busy Redis indexes."""

        indexed_as_free = payload.status == "online" and payload.can_receive_orders
        now = datetime.now(timezone.utc).isoformat()

        await self.redis.hset(
            self._status_key(driver_id),
            mapping={
                "can_receive_orders": "1" if payload.can_receive_orders else "0",
                "driver_role": payload.driver_role,
                "latitude": str(payload.latitude),
                "longitude": str(payload.longitude),
                "park_id": payload.park_id or "",
                "status": payload.status,
                "updated_at": now,
            },
        )
        await self.redis.execute_command(
            "GEOADD",
            self.all_geo_key,
            payload.longitude,
            payload.latitude,
            driver_id,
        )

        if indexed_as_free:
            await self.redis.execute_command(
                "GEOADD",
                self.free_geo_key,
                payload.longitude,
                payload.latitude,
                driver_id,
            )
        else:
            await self.redis.zrem(self.free_geo_key, driver_id)

        return indexed_as_free

    async def mark_status(self, driver_id: str, status: DriverAvailabilityStatus) -> None:
        """Update only logical driver status and remove unavailable drivers from free GEO."""

        await self.redis.hset(self._status_key(driver_id), mapping={"status": status})
        if status != "online":
            await self.redis.zrem(self.free_geo_key, driver_id)

    async def nearby_free_drivers(
        self,
        latitude: float,
        longitude: float,
        radius_meters: int,
        limit: int = 20,
    ) -> list[DriverCandidate]:
        """Return nearest online/free drivers using Redis GEOSEARCH."""

        raw = await self.redis.execute_command(
            "GEOSEARCH",
            self.free_geo_key,
            "FROMLONLAT",
            longitude,
            latitude,
            "BYRADIUS",
            radius_meters,
            "m",
            "WITHDIST",
            "WITHCOORD",
            "ASC",
            "COUNT",
            limit,
        )
        candidates: list[DriverCandidate] = []

        for entry in raw or []:
            driver_id, distance, coords = self._parse_geosearch_entry(entry)
            if not driver_id:
                continue

            status = await self.redis.hgetall(self._status_key(driver_id))
            if status.get("status") != "online" or status.get("can_receive_orders") == "0":
                await self.redis.zrem(self.free_geo_key, driver_id)
                continue

            candidates.append(
                DriverCandidate(
                    driver_id=driver_id,
                    distance_meters=distance,
                    latitude=coords[1],
                    longitude=coords[0],
                    driver_role=status.get("driver_role") or "self_employed_driver",
                    park_id=status.get("park_id") or None,
                    status="online",
                ),
            )

        return candidates

    async def count_free_drivers(self, latitude: float, longitude: float, radius_meters: int) -> int:
        """Count free drivers around a point without exposing driver details."""

        return len(
            await self.nearby_free_drivers(
                latitude=latitude,
                longitude=longitude,
                radius_meters=radius_meters,
                limit=500,
            ),
        )

    @staticmethod
    def to_schema(candidate: DriverCandidate) -> NearbyDriver:
        """Convert an internal candidate to the public response schema."""

        return NearbyDriver(
            driver_id=candidate.driver_id,
            distance_meters=candidate.distance_meters,
            latitude=candidate.latitude,
            longitude=candidate.longitude,
            driver_role=candidate.driver_role,  # type: ignore[arg-type]
            park_id=candidate.park_id,
            status=candidate.status,
        )

    @staticmethod
    def _status_key(driver_id: str) -> str:
        return f"driver:{driver_id}:status"

    @staticmethod
    def _parse_geosearch_entry(entry: object) -> tuple[str, float, tuple[float, float]]:
        if not isinstance(entry, (list, tuple)) or len(entry) < 3:
            return "", 0.0, (0.0, 0.0)

        driver_id = str(entry[0])
        distance = float(entry[1])
        coords = entry[2]
        return driver_id, distance, (float(coords[0]), float(coords[1]))
