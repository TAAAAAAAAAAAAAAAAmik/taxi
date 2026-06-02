from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Park, Subscription
from app.schemas import SubscriptionStatusResponse

DRIVER_MONTHLY_AMOUNT = Decimal("3000.00")
PARK_MONTHLY_AMOUNT = Decimal("6000.00")
SUBSCRIPTION_DAYS = 30


class BillingService:
    """Subscription billing rules for self-employed drivers and taxi parks."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def subscription_status(
        self,
        *,
        user_id: str | None = None,
        park_id: str | None = None,
    ) -> SubscriptionStatusResponse:
        """Return the latest active/expired subscription for a driver or park."""

        subscription = await self._latest_subscription(user_id=user_id, park_id=park_id)
        owner_id = park_id or user_id or ""
        subscription_type = "park_monthly" if park_id else "driver_monthly"
        amount = PARK_MONTHLY_AMOUNT if park_id else DRIVER_MONTHLY_AMOUNT

        if not subscription:
            return SubscriptionStatusResponse(
                active=False,
                amount=amount,
                owner_id=owner_id,
                status="expired",
                type=subscription_type,
            )

        active = subscription.status == "active" and subscription.expires_at > self._now()
        return SubscriptionStatusResponse(
            active=active,
            amount=subscription.amount,
            expires_at=subscription.expires_at,
            owner_id=owner_id,
            status="active" if active else "expired",
            type=subscription_type,
        )

    async def activate_subscription(
        self,
        *,
        user_id: str | None = None,
        park_id: str | None = None,
        provider_payment_id: str | None = None,
        starts_at: datetime | None = None,
    ) -> Subscription:
        """Activate or extend a monthly subscription for 30 days."""

        now = starts_at or self._now()
        subscription_type = "park_monthly" if park_id else "driver_monthly"
        amount = PARK_MONTHLY_AMOUNT if park_id else DRIVER_MONTHLY_AMOUNT
        current = await self._latest_subscription(user_id=user_id, park_id=park_id)
        base = current.expires_at if current and current.status == "active" and current.expires_at > now else now
        expires_at = base + timedelta(days=SUBSCRIPTION_DAYS)

        subscription = Subscription(
            amount=amount,
            expires_at=expires_at,
            park_id=park_id,
            provider_payment_id=provider_payment_id,
            starts_at=now,
            status="active",
            type=subscription_type,
            user_id=user_id,
        )
        self.session.add(subscription)

        if park_id:
            park = await self.session.get(Park, park_id)
            if park:
                park.status = "active"
                park.subscription_expires_at = expires_at
                park.updated_at = now

        await self.session.commit()
        return subscription

    async def expire_overdue_subscriptions(self) -> int:
        """Mark overdue subscription rows as expired and block overdue parks."""

        now = self._now()
        result = await self.session.scalars(
            select(Subscription).where(Subscription.status == "active", Subscription.expires_at <= now),
        )
        expired = 0
        for subscription in result:
            subscription.status = "expired"
            subscription.updated_at = now
            expired += 1
            if subscription.park_id:
                park = await self.session.get(Park, subscription.park_id)
                if park and park.subscription_expires_at and park.subscription_expires_at <= now:
                    park.status = "pending"

        if expired:
            await self.session.commit()
        return expired

    async def expiring_in_days(self, days: int = 3) -> list[Subscription]:
        """Return active subscriptions that expire inside the notification window."""

        now = self._now()
        deadline = now + timedelta(days=days)
        result = await self.session.scalars(
            select(Subscription).where(
                Subscription.status == "active",
                Subscription.expires_at > now,
                Subscription.expires_at <= deadline,
                or_(Subscription.user_id.is_not(None), Subscription.park_id.is_not(None)),
            ),
        )
        return list(result)

    async def _latest_subscription(
        self,
        *,
        user_id: str | None = None,
        park_id: str | None = None,
    ) -> Subscription | None:
        filters = []
        if user_id:
            filters.append(Subscription.user_id == user_id)
        if park_id:
            filters.append(Subscription.park_id == park_id)
        if not filters:
            return None

        return await self.session.scalar(
            select(Subscription).where(*filters).order_by(Subscription.expires_at.desc()).limit(1),
        )

    @staticmethod
    def _now() -> datetime:
        return datetime.now(timezone.utc)
