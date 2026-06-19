from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.node_client import NodeBackendClient, get_node_client
from app.schemas import FinanceSettlementRequest, FinanceSettlementResponse
from app.services.finance import FinanceService

router = APIRouter(prefix="/finance", tags=["finance"])


@router.post("/orders/{order_id}/settle", response_model=FinanceSettlementResponse)
async def settle_order(
    order_id: str,
    payload: FinanceSettlementRequest,
    session: AsyncSession = Depends(get_session),
    node_client: NodeBackendClient = Depends(get_node_client),
) -> FinanceSettlementResponse:
    """Settle a completed trip and autocompensate the driver if capture fails."""

    return await FinanceService(session, node_client).settle_order(order_id, payload)

