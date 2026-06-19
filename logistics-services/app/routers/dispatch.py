from fastapi import APIRouter, Depends
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import get_session
from app.core.node_client import NodeBackendClient, get_node_client
from app.core.redis import get_redis
from app.schemas import DispatchEnqueueRequest, DispatchEnqueueResponse, DriverOfferResponseRequest
from app.services.dispatcher import DispatcherService

router = APIRouter(prefix="/dispatch", tags=["dispatch"])


@router.post("/orders/{order_id}/enqueue", response_model=DispatchEnqueueResponse)
async def enqueue_order(
    order_id: str,
    payload: DispatchEnqueueRequest,
    redis: Redis = Depends(get_redis),
    session: AsyncSession = Depends(get_session),
    node_client: NodeBackendClient = Depends(get_node_client),
) -> DispatchEnqueueResponse:
    """Place an order into the Redis Stream consumed by logistics workers."""

    settings = get_settings()
    mode = payload.mode or settings.dispatch_mode
    stream_id = await DispatcherService(redis, session, node_client, settings).enqueue_order(
        order_id,
        payload.pickup,
        payload.order,
        mode,
    )
    return DispatchEnqueueResponse(enqueued=True, mode=mode, order_id=order_id, stream_id=stream_id)


@router.post("/orders/{order_id}/offers/{driver_id}/response")
async def driver_offer_response(
    order_id: str,
    driver_id: str,
    payload: DriverOfferResponseRequest,
    offer_id: str | None = None,
    redis: Redis = Depends(get_redis),
    session: AsyncSession = Depends(get_session),
    node_client: NodeBackendClient = Depends(get_node_client),
) -> dict[str, str]:
    """Accept driver answers from Node WebSocket handlers or internal tooling."""

    stream_id = await DispatcherService(redis, session, node_client).publish_driver_response(
        order_id=order_id,
        driver_id=driver_id,
        decision=payload.decision,
        reason=payload.reason,
        offer_id=offer_id,
    )
    return {"stream_id": stream_id}

