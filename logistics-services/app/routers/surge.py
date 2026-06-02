from fastapi import APIRouter, Depends
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.redis import get_redis
from app.schemas import SurgeQuoteRequest, SurgeQuoteResponse
from app.services.surge import SurgePricingService

router = APIRouter(prefix="/surge", tags=["surge"])


@router.post("/quote", response_model=SurgeQuoteResponse)
async def quote_surge(
    payload: SurgeQuoteRequest,
    redis: Redis = Depends(get_redis),
    session: AsyncSession = Depends(get_session),
) -> SurgeQuoteResponse:
    """Return a pre-order fare quote with the current surge coefficient."""

    return await SurgePricingService(redis=redis, session=session).quote(payload)

