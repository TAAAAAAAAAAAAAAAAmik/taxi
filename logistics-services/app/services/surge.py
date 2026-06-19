from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from time import time
from uuid import uuid4

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.models import SurgeLog
from app.schemas import GeoPoint, SurgeQuoteRequest, SurgeQuoteResponse
from app.services.driver_geo import DriverGeoService

MONEY = Decimal("0.01")


class SurgePricingService:
    """Calculate real-time surge coefficients from Redis demand/supply signals."""

    def __init__(
        self,
        redis: Redis,
        session: AsyncSession | None = None,
        settings: Settings | None = None,
        driver_geo: DriverGeoService | None = None,
    ) -> None:
        self.redis = redis
        self.session = session
        self.settings = settings or get_settings()
        self.driver_geo = driver_geo or DriverGeoService(redis)

    async def quote(self, payload: SurgeQuoteRequest) -> SurgeQuoteResponse:
        """Record a price-view pin and return a surge-adjusted fare."""

        quote_id = payload.quote_id or f"quote_{uuid4().hex}"
        zone_id = payload.zone_id or self._zone_id(payload.pickup)
        demand_pins = await self._record_price_pin(zone_id, quote_id, payload.customer_id)
        free_drivers = await self.driver_geo.count_free_drivers(
            latitude=payload.pickup.latitude,
            longitude=payload.pickup.longitude,
            radius_meters=self.settings.surge_radius_meters,
        )
        ratio = self._ratio(demand_pins, free_drivers)
        coefficient = self._coefficient(demand_pins, free_drivers, ratio)
        final_price = (payload.base_price * coefficient).quantize(MONEY, rounding=ROUND_HALF_UP)

        response = SurgeQuoteResponse(
            base_price=payload.base_price.quantize(MONEY, rounding=ROUND_HALF_UP),
            coefficient=coefficient,
            demand_pins=demand_pins,
            final_price=final_price,
            free_drivers=free_drivers,
            quote_id=quote_id,
            ratio=ratio,
            zone_id=zone_id,
        )
        await self._persist(payload, response)
        return response

    async def _record_price_pin(self, zone_id: str, quote_id: str, customer_id: str | None) -> int:
        now = int(time())
        expires_at = now + self.settings.surge_pin_ttl_seconds
        key = self._pin_key(zone_id)
        member = customer_id or quote_id

        await self.redis.zremrangebyscore(key, "-inf", now)
        await self.redis.zadd(key, {member: expires_at})
        await self.redis.expire(key, self.settings.surge_pin_ttl_seconds * 2)
        return int(await self.redis.zcard(key))

    async def _persist(self, request: SurgeQuoteRequest, response: SurgeQuoteResponse) -> None:
        if not self.session:
            return

        self.session.add(
            SurgeLog(
                quote_id=response.quote_id,
                zone_id=response.zone_id,
                pickup_latitude=Decimal(str(request.pickup.latitude)),
                pickup_longitude=Decimal(str(request.pickup.longitude)),
                base_price=response.base_price,
                final_price=response.final_price,
                coefficient=response.coefficient,
                demand_pins=response.demand_pins,
                free_drivers=response.free_drivers,
                ratio=response.ratio,
                created_at=datetime.now(timezone.utc),
            ),
        )
        await self.session.commit()

    @staticmethod
    def _ratio(demand_pins: int, free_drivers: int) -> Decimal:
        if free_drivers <= 0:
            return Decimal(str(demand_pins or 1))
        return (Decimal(demand_pins) / Decimal(free_drivers)).quantize(
            Decimal("0.001"),
            rounding=ROUND_HALF_UP,
        )

    @staticmethod
    def _coefficient(demand_pins: int, free_drivers: int, ratio: Decimal) -> Decimal:
        if demand_pins > 0 and free_drivers == 0:
            return Decimal("2.0")
        if ratio > Decimal("3.0"):
            return Decimal("2.0")
        if ratio > Decimal("2.0"):
            return Decimal("1.5")
        if ratio > Decimal("1.5"):
            return Decimal("1.2")
        return Decimal("1.0")

    @staticmethod
    def _zone_id(point: GeoPoint) -> str:
        return f"zone:{round(point.latitude, 3)}:{round(point.longitude, 3)}"

    @staticmethod
    def _pin_key(zone_id: str) -> str:
        return f"surge:pins:{zone_id}"

