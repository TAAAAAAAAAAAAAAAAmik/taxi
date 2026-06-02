from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Index, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def utcnow() -> datetime:
    """Return a timezone-aware UTC timestamp."""

    return datetime.now(timezone.utc)


def new_id(prefix: str) -> str:
    """Create compact text IDs that are easy to trace in logs."""

    return f"{prefix}_{uuid4().hex}"


class Base(DeclarativeBase):
    """Declarative base for logistics-owned tables."""


class SurgeLog(Base):
    """Audit trail for surge quote calculations."""

    __tablename__ = "surge_logs"

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: new_id("surge"))
    quote_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    zone_id: Mapped[str] = mapped_column(String(128), index=True)
    pickup_latitude: Mapped[Decimal] = mapped_column(Numeric(9, 6))
    pickup_longitude: Mapped[Decimal] = mapped_column(Numeric(9, 6))
    base_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    final_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    coefficient: Mapped[Decimal] = mapped_column(Numeric(4, 2))
    demand_pins: Mapped[int]
    free_drivers: Mapped[int]
    ratio: Mapped[Decimal] = mapped_column(Numeric(8, 3))
    source: Mapped[str] = mapped_column(String(32), default="redis")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class DispatchEvent(Base):
    """Append-only dispatch audit log and idempotency ledger."""

    __tablename__ = "dispatch_events"
    __table_args__ = (
        UniqueConstraint("idempotency_key", name="uq_dispatch_events_idempotency_key"),
        Index("ix_dispatch_events_order_type", "order_id", "event_type"),
    )

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: new_id("disp"))
    order_id: Mapped[str] = mapped_column(String(96), index=True)
    batch_id: Mapped[str | None] = mapped_column(String(96), nullable=True, index=True)
    event_type: Mapped[str] = mapped_column(String(64), index=True)
    driver_id: Mapped[str | None] = mapped_column(String(96), nullable=True, index=True)
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    idempotency_key: Mapped[str | None] = mapped_column(String(180), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class AddressPoint(Base):
    """Imported address point from GAR/FIAS or OSM."""

    __tablename__ = "address_points"
    __table_args__ = (
        UniqueConstraint("source", "source_id", name="uq_address_points_source_id"),
        UniqueConstraint("normalized_key", name="uq_address_points_normalized_key"),
        Index("ix_address_points_lookup", "district", "settlement", "street", "house_number"),
    )

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: new_id("addr"))
    source: Mapped[str] = mapped_column(String(24), index=True)
    source_id: Mapped[str] = mapped_column(String(160))
    normalized_key: Mapped[str] = mapped_column(String(300))
    region_code: Mapped[str] = mapped_column(String(8), default="02")
    district: Mapped[str] = mapped_column(String(160), default="Салаватский район")
    settlement: Mapped[str] = mapped_column(String(160), default="")
    street: Mapped[str] = mapped_column(String(220), default="")
    house_number: Mapped[str] = mapped_column(String(64), default="")
    full_address: Mapped[str] = mapped_column(String(500))
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6), nullable=True)
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6), nullable=True)
    fias_object_guid: Mapped[str | None] = mapped_column(String(96), nullable=True, index=True)
    osm_type: Mapped[str | None] = mapped_column(String(24), nullable=True)
    osm_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    marketer_id: Mapped[str | None] = mapped_column(String(96), nullable=True, index=True)
    contract_status: Mapped[str] = mapped_column(String(32), default="draft", index=True)
    qr_code_id: Mapped[str | None] = mapped_column(String(96), nullable=True, index=True)
    install_count: Mapped[int] = mapped_column(Integer, default=0)
    monthly_install_count: Mapped[int] = mapped_column(Integer, default=0)
    imported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class MarketingLevel(Base):
    """Reference table for Victory Points level thresholds."""

    __tablename__ = "marketing_levels"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(32), unique=True)
    name: Mapped[str] = mapped_column(String(80))
    min_points: Mapped[int] = mapped_column(Integer)
    max_points: Mapped[int | None] = mapped_column(Integer, nullable=True)
    coefficient: Mapped[Decimal] = mapped_column(Numeric(4, 2), default=Decimal("1.00"))


class MarketingPartner(Base):
    """Marketing partner profile and Victory Points balance."""

    __tablename__ = "marketing_partners"
    __table_args__ = (
        UniqueConstraint("user_id", name="uq_marketing_partners_user_id"),
        UniqueConstraint("invite_code", name="uq_marketing_partners_invite_code"),
        Index("ix_marketing_partners_status_level", "status", "level_id"),
    )

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: new_id("mkt"))
    user_id: Mapped[str] = mapped_column(String(96), index=True)
    name: Mapped[str] = mapped_column(String(180))
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    email: Mapped[str | None] = mapped_column(String(180), nullable=True)
    invite_code: Mapped[str] = mapped_column(String(64), index=True)
    balance_points: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"))
    base_earned_points: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"))
    paid_out_points: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"))
    total_earned_points: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"))
    level_id: Mapped[int] = mapped_column(Integer, ForeignKey("marketing_levels.id"), default=1)
    status: Mapped[str] = mapped_column(String(32), default="active", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class MarketingAction(Base):
    """Victory Points accrual, confirmation, rejection, and payout ledger."""

    __tablename__ = "marketing_actions"
    __table_args__ = (
        UniqueConstraint("marketer_id", "type", "source_id", name="uq_marketing_actions_source"),
        Index("ix_marketing_actions_marketer_status", "marketer_id", "status"),
    )

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: new_id("mact"))
    marketer_id: Mapped[str] = mapped_column(String(48), ForeignKey("marketing_partners.id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String(64), index=True)
    source_id: Mapped[str] = mapped_column(String(120), index=True)
    status: Mapped[str] = mapped_column(String(32), default="rewarded", index=True)
    base_points: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"))
    points: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"))
    description: Mapped[str] = mapped_column(String(500), default="")
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class FinanceEvent(Base):
    """Idempotent financial event log for trip settlement and retries."""

    __tablename__ = "finance_events"
    __table_args__ = (
        UniqueConstraint("idempotency_key", name="uq_finance_events_idempotency_key"),
        Index("ix_finance_events_order_type", "order_id", "event_type"),
    )

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: new_id("fin"))
    order_id: Mapped[str] = mapped_column(String(96), index=True)
    event_type: Mapped[str] = mapped_column(String(64), index=True)
    driver_id: Mapped[str | None] = mapped_column(String(96), nullable=True, index=True)
    client_id: Mapped[str | None] = mapped_column(String(96), nullable=True, index=True)
    gross_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"))
    commission_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"))
    driver_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"))
    status: Mapped[str] = mapped_column(String(32), default="pending", index=True)
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    idempotency_key: Mapped[str | None] = mapped_column(String(180), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class DriverBalance(Base):
    """Internal logistics-side mirror of driver balance movements."""

    __tablename__ = "driver_balances"

    driver_id: Mapped[str] = mapped_column(String(96), primary_key=True)
    available_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"))
    pending_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"))
    compensated_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class Park(Base):
    """Taxi park legal profile managed by a park administrator."""

    __tablename__ = "parks"
    __table_args__ = (Index("ix_parks_status_subscription", "status", "subscription_expires_at"),)

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: new_id("park"))
    owner_user_id: Mapped[str] = mapped_column(String(96), index=True)
    organisation_name: Mapped[str] = mapped_column(String(240))
    inn: Mapped[str] = mapped_column(String(12), index=True)
    ogrn: Mapped[str] = mapped_column(String(15), index=True)
    legal_address: Mapped[str] = mapped_column(String(500))
    contact_phone: Mapped[str] = mapped_column(String(32))
    settlement_account: Mapped[str] = mapped_column(String(64))
    subscription_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="pending", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class ParkDriver(Base):
    """Invitation and membership state for a driver attached to a taxi park."""

    __tablename__ = "park_drivers"
    __table_args__ = (
        UniqueConstraint("invite_code", name="uq_park_drivers_invite_code"),
        UniqueConstraint("user_id", name="uq_park_drivers_user_id"),
    )

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: new_id("parkdrv"))
    user_id: Mapped[str | None] = mapped_column(String(96), nullable=True, index=True)
    driver_id: Mapped[str | None] = mapped_column(String(96), nullable=True, index=True)
    park_id: Mapped[str] = mapped_column(String(48), ForeignKey("parks.id", ondelete="CASCADE"), index=True)
    invite_code: Mapped[str] = mapped_column(String(64), index=True)
    status: Mapped[str] = mapped_column(String(32), default="invited", index=True)
    invited_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    invited_by_user_id: Mapped[str | None] = mapped_column(String(96), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class ParkVehicle(Base):
    """Vehicle owned or controlled by a taxi park."""

    __tablename__ = "park_vehicles"
    __table_args__ = (Index("ix_park_vehicles_park_driver", "park_id", "driver_id"),)

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: new_id("vehicle"))
    park_id: Mapped[str] = mapped_column(String(48), ForeignKey("parks.id", ondelete="CASCADE"), index=True)
    driver_id: Mapped[str | None] = mapped_column(String(96), nullable=True, index=True)
    brand: Mapped[str] = mapped_column(String(120))
    model: Mapped[str] = mapped_column(String(120))
    plate: Mapped[str] = mapped_column(String(32), index=True)
    sts_number: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(32), default="active", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class Subscription(Base):
    """Monthly subscription for a self-employed driver or a taxi park."""

    __tablename__ = "subscriptions"
    __table_args__ = (
        Index("ix_subscriptions_owner_status", "user_id", "park_id", "status"),
        Index("ix_subscriptions_expires_at", "expires_at"),
    )

    id: Mapped[str] = mapped_column(String(48), primary_key=True, default=lambda: new_id("sub"))
    user_id: Mapped[str | None] = mapped_column(String(96), nullable=True, index=True)
    park_id: Mapped[str | None] = mapped_column(String(48), ForeignKey("parks.id", ondelete="CASCADE"), nullable=True, index=True)
    type: Mapped[str] = mapped_column(String(32), index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    status: Mapped[str] = mapped_column(String(32), default="active", index=True)
    provider_payment_id: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
