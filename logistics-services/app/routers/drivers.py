from fastapi import APIRouter, Depends, Query
from redis.asyncio import Redis

from app.core.config import get_settings
from app.core.redis import get_redis
from app.schemas import DriverLocationRequest, DriverLocationResponse, NearbyDriversResponse
from app.services.driver_geo import DriverGeoService

router = APIRouter(prefix="/drivers", tags=["drivers"])


@router.post("/{driver_id}/location", response_model=DriverLocationResponse)
async def update_driver_location(
    driver_id: str,
    payload: DriverLocationRequest,
    redis: Redis = Depends(get_redis),
) -> DriverLocationResponse:
    """Update driver location and Redis GEO availability indexes."""

    indexed_as_free = await DriverGeoService(redis).update_location(driver_id, payload)
    return DriverLocationResponse(driver_id=driver_id, indexed_as_free=indexed_as_free, status=payload.status)


@router.get("/nearby", response_model=NearbyDriversResponse)
async def nearby_drivers(
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=180),
    radius_meters: int | None = Query(default=None, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    redis: Redis = Depends(get_redis),
) -> NearbyDriversResponse:
    """Find nearest online/free drivers around a pickup point."""

    settings = get_settings()
    service = DriverGeoService(redis)
    drivers = await service.nearby_free_drivers(
        latitude=latitude,
        longitude=longitude,
        radius_meters=radius_meters or settings.default_search_radius_meters,
        limit=limit,
    )
    return NearbyDriversResponse(drivers=[service.to_schema(driver) for driver in drivers])

