from fastapi import FastAPI

from app.core.config import get_settings
from app.core.redis import make_redis
from app.routers import addresses, billing, dispatch, drivers, finance, parks, roles, surge

settings = get_settings()

app = FastAPI(
    title="Kinetix Taxi Logistics",
    version="0.1.0",
    description="Surge pricing, Redis GEO, dispatch, finance, and address import services.",
)

app.include_router(surge.router, prefix=settings.api_prefix)
app.include_router(drivers.router, prefix=settings.api_prefix)
app.include_router(dispatch.router, prefix=settings.api_prefix)
app.include_router(finance.router, prefix=settings.api_prefix)
app.include_router(addresses.router, prefix=settings.api_prefix)
app.include_router(roles.router, prefix=settings.api_prefix)
app.include_router(billing.router, prefix=settings.api_prefix)
app.include_router(parks.router, prefix=settings.api_prefix)


@app.get("/health")
async def health() -> dict[str, object]:
    """Return a lightweight health response with Redis connectivity."""

    redis = make_redis()
    redis_error: str | None = None
    try:
        try:
            redis_ok = bool(await redis.ping())
        except Exception as error:
            redis_ok = False
            redis_error = str(error)
    finally:
        await redis.aclose()

    return {
        "environment": settings.environment,
        "ok": True,
        "redis_error": redis_error,
        "redis_ok": redis_ok,
        "service": settings.service_name,
        "version": app.version,
    }
