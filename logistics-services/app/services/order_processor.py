import json

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.node_client import NodeBackendClient
from app.schemas import GeoPoint
from app.services.dispatcher import DispatchOrder, DispatchResult, DispatcherService


class OrderProcessor:
    """Process pending order messages into dispatch decisions."""

    def __init__(
        self,
        redis: Redis,
        session: AsyncSession,
        node_client: NodeBackendClient,
        settings: Settings | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.dispatcher = DispatcherService(redis, session, node_client, self.settings)

    async def process_order(self, message: dict[str, str]) -> DispatchResult:
        """Process one Redis Stream order message."""

        order = self._parse_message(message)
        mode = message.get("mode") or self.settings.dispatch_mode
        if mode == "batch":
            results = await self.dispatcher.dispatch_batch([order])
            return results[0]
        return await self.dispatcher.dispatch_greedy(order)

    async def process_batch(self, messages: list[dict[str, str]]) -> list[DispatchResult]:
        """Process a batch window as one assignment problem."""

        orders = [self._parse_message(message) for message in messages]
        return await self.dispatcher.dispatch_batch(orders)

    @staticmethod
    def _parse_message(message: dict[str, str]) -> DispatchOrder:
        order_id = message["order_id"]
        payload = json.loads(message.get("order") or "{}")
        pickup = GeoPoint(
            latitude=float(message["pickup_latitude"]),
            longitude=float(message["pickup_longitude"]),
        )
        return DispatchOrder(order_id=order_id, pickup=pickup, payload=payload)

