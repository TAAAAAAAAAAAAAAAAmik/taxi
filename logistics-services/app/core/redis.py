from collections.abc import AsyncIterator

from redis.asyncio import Redis

from app.core.config import get_settings

settings = get_settings()


def make_redis() -> Redis:
    """Create a Redis client with decoded string responses."""

    return Redis.from_url(settings.redis_url, decode_responses=True)


async def get_redis() -> AsyncIterator[Redis]:
    """Yield a Redis client and close it after the request."""

    client = make_redis()
    try:
        yield client
    finally:
        await client.aclose()

