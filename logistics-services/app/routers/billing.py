from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.schemas import SubscriptionActivationRequest, SubscriptionStatusResponse
from app.services.billing import BillingService

router = APIRouter(prefix="/billing", tags=["billing"])


@router.get("/drivers/{user_id}/subscription", response_model=SubscriptionStatusResponse)
async def driver_subscription_status(
    user_id: str,
    session: AsyncSession = Depends(get_session),
) -> SubscriptionStatusResponse:
    """Return self-employed driver subscription status."""

    return await BillingService(session).subscription_status(user_id=user_id)


@router.post("/drivers/{user_id}/subscription/activate", response_model=SubscriptionStatusResponse)
async def activate_driver_subscription(
    user_id: str,
    payload: SubscriptionActivationRequest,
    session: AsyncSession = Depends(get_session),
) -> SubscriptionStatusResponse:
    """Activate or extend a self-employed driver subscription for 30 days."""

    await BillingService(session).activate_subscription(
        provider_payment_id=payload.provider_payment_id,
        starts_at=payload.starts_at,
        user_id=user_id,
    )
    return await BillingService(session).subscription_status(user_id=user_id)


@router.get("/parks/{park_id}/subscription", response_model=SubscriptionStatusResponse)
async def park_subscription_status(
    park_id: str,
    session: AsyncSession = Depends(get_session),
) -> SubscriptionStatusResponse:
    """Return taxi park subscription status."""

    return await BillingService(session).subscription_status(park_id=park_id)


@router.post("/parks/{park_id}/subscription/activate", response_model=SubscriptionStatusResponse)
async def activate_park_subscription(
    park_id: str,
    payload: SubscriptionActivationRequest,
    session: AsyncSession = Depends(get_session),
) -> SubscriptionStatusResponse:
    """Activate or extend a taxi park subscription for 30 days."""

    await BillingService(session).activate_subscription(
        park_id=park_id,
        provider_payment_id=payload.provider_payment_id,
        starts_at=payload.starts_at,
    )
    return await BillingService(session).subscription_status(park_id=park_id)
