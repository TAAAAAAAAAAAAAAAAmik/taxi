"""Create logistics service tables.

Revision ID: 0001_logistics_tables
Revises:
Create Date: 2026-05-26
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_logistics_tables"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create logistics-owned tables and additive order columns."""

    op.create_table(
        "surge_logs",
        sa.Column("id", sa.String(length=48), primary_key=True),
        sa.Column("quote_id", sa.String(length=64), nullable=False),
        sa.Column("zone_id", sa.String(length=128), nullable=False),
        sa.Column("pickup_latitude", sa.Numeric(9, 6), nullable=False),
        sa.Column("pickup_longitude", sa.Numeric(9, 6), nullable=False),
        sa.Column("base_price", sa.Numeric(12, 2), nullable=False),
        sa.Column("final_price", sa.Numeric(12, 2), nullable=False),
        sa.Column("coefficient", sa.Numeric(4, 2), nullable=False),
        sa.Column("demand_pins", sa.Integer(), nullable=False),
        sa.Column("free_drivers", sa.Integer(), nullable=False),
        sa.Column("ratio", sa.Numeric(8, 3), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False, server_default="redis"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_surge_logs_created_at", "surge_logs", ["created_at"])
    op.create_index("ix_surge_logs_quote_id", "surge_logs", ["quote_id"], unique=True)
    op.create_index("ix_surge_logs_zone_id", "surge_logs", ["zone_id"])

    op.create_table(
        "dispatch_events",
        sa.Column("id", sa.String(length=48), primary_key=True),
        sa.Column("order_id", sa.String(length=96), nullable=False),
        sa.Column("batch_id", sa.String(length=96), nullable=True),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("driver_id", sa.String(length=96), nullable=True),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("idempotency_key", sa.String(length=180), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("idempotency_key", name="uq_dispatch_events_idempotency_key"),
    )
    op.create_index("ix_dispatch_events_batch_id", "dispatch_events", ["batch_id"])
    op.create_index("ix_dispatch_events_driver_id", "dispatch_events", ["driver_id"])
    op.create_index("ix_dispatch_events_event_type", "dispatch_events", ["event_type"])
    op.create_index("ix_dispatch_events_order_id", "dispatch_events", ["order_id"])
    op.create_index("ix_dispatch_events_order_type", "dispatch_events", ["order_id", "event_type"])

    op.create_table(
        "address_points",
        sa.Column("id", sa.String(length=48), primary_key=True),
        sa.Column("source", sa.String(length=24), nullable=False),
        sa.Column("source_id", sa.String(length=160), nullable=False),
        sa.Column("normalized_key", sa.String(length=300), nullable=False),
        sa.Column("region_code", sa.String(length=8), nullable=False, server_default="02"),
        sa.Column("district", sa.String(length=160), nullable=False, server_default="Салаватский район"),
        sa.Column("settlement", sa.String(length=160), nullable=False, server_default=""),
        sa.Column("street", sa.String(length=220), nullable=False, server_default=""),
        sa.Column("house_number", sa.String(length=64), nullable=False, server_default=""),
        sa.Column("full_address", sa.String(length=500), nullable=False),
        sa.Column("latitude", sa.Numeric(9, 6), nullable=True),
        sa.Column("longitude", sa.Numeric(9, 6), nullable=True),
        sa.Column("fias_object_guid", sa.String(length=96), nullable=True),
        sa.Column("osm_type", sa.String(length=24), nullable=True),
        sa.Column("osm_id", sa.String(length=64), nullable=True),
        sa.Column("imported_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("normalized_key", name="uq_address_points_normalized_key"),
        sa.UniqueConstraint("source", "source_id", name="uq_address_points_source_id"),
    )
    op.create_index("ix_address_points_fias_object_guid", "address_points", ["fias_object_guid"])
    op.create_index("ix_address_points_lookup", "address_points", ["district", "settlement", "street", "house_number"])
    op.create_index("ix_address_points_source", "address_points", ["source"])

    op.create_table(
        "finance_events",
        sa.Column("id", sa.String(length=48), primary_key=True),
        sa.Column("order_id", sa.String(length=96), nullable=False),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("driver_id", sa.String(length=96), nullable=True),
        sa.Column("client_id", sa.String(length=96), nullable=True),
        sa.Column("gross_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("commission_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("driver_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="pending"),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("idempotency_key", sa.String(length=180), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("idempotency_key", name="uq_finance_events_idempotency_key"),
    )
    op.create_index("ix_finance_events_client_id", "finance_events", ["client_id"])
    op.create_index("ix_finance_events_driver_id", "finance_events", ["driver_id"])
    op.create_index("ix_finance_events_event_type", "finance_events", ["event_type"])
    op.create_index("ix_finance_events_order_id", "finance_events", ["order_id"])
    op.create_index("ix_finance_events_order_type", "finance_events", ["order_id", "event_type"])
    op.create_index("ix_finance_events_status", "finance_events", ["status"])

    op.create_table(
        "driver_balances",
        sa.Column("driver_id", sa.String(length=96), primary_key=True),
        sa.Column("available_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("pending_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("compensated_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "parks",
        sa.Column("id", sa.String(length=48), primary_key=True),
        sa.Column("owner_user_id", sa.String(length=96), nullable=False),
        sa.Column("organisation_name", sa.String(length=240), nullable=False),
        sa.Column("inn", sa.String(length=12), nullable=False),
        sa.Column("ogrn", sa.String(length=15), nullable=False),
        sa.Column("legal_address", sa.String(length=500), nullable=False),
        sa.Column("contact_phone", sa.String(length=32), nullable=False),
        sa.Column("settlement_account", sa.String(length=64), nullable=False),
        sa.Column("subscription_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_parks_inn", "parks", ["inn"])
    op.create_index("ix_parks_ogrn", "parks", ["ogrn"])
    op.create_index("ix_parks_owner_user_id", "parks", ["owner_user_id"])
    op.create_index("ix_parks_status", "parks", ["status"])
    op.create_index("ix_parks_status_subscription", "parks", ["status", "subscription_expires_at"])

    op.create_table(
        "park_drivers",
        sa.Column("id", sa.String(length=48), primary_key=True),
        sa.Column("user_id", sa.String(length=96), nullable=True),
        sa.Column("driver_id", sa.String(length=96), nullable=True),
        sa.Column("park_id", sa.String(length=48), sa.ForeignKey("parks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("invite_code", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="invited"),
        sa.Column("invited_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("invited_by_user_id", sa.String(length=96), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("invite_code", name="uq_park_drivers_invite_code"),
        sa.UniqueConstraint("user_id", name="uq_park_drivers_user_id"),
    )
    op.create_index("ix_park_drivers_driver_id", "park_drivers", ["driver_id"])
    op.create_index("ix_park_drivers_invite_code", "park_drivers", ["invite_code"])
    op.create_index("ix_park_drivers_park_id", "park_drivers", ["park_id"])
    op.create_index("ix_park_drivers_status", "park_drivers", ["status"])
    op.create_index("ix_park_drivers_user_id", "park_drivers", ["user_id"])

    op.create_table(
        "park_vehicles",
        sa.Column("id", sa.String(length=48), primary_key=True),
        sa.Column("park_id", sa.String(length=48), sa.ForeignKey("parks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("driver_id", sa.String(length=96), nullable=True),
        sa.Column("brand", sa.String(length=120), nullable=False),
        sa.Column("model", sa.String(length=120), nullable=False),
        sa.Column("plate", sa.String(length=32), nullable=False),
        sa.Column("sts_number", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_park_vehicles_driver_id", "park_vehicles", ["driver_id"])
    op.create_index("ix_park_vehicles_park_driver", "park_vehicles", ["park_id", "driver_id"])
    op.create_index("ix_park_vehicles_park_id", "park_vehicles", ["park_id"])
    op.create_index("ix_park_vehicles_plate", "park_vehicles", ["plate"])
    op.create_index("ix_park_vehicles_status", "park_vehicles", ["status"])

    op.create_table(
        "subscriptions",
        sa.Column("id", sa.String(length=48), primary_key=True),
        sa.Column("user_id", sa.String(length=96), nullable=True),
        sa.Column("park_id", sa.String(length=48), sa.ForeignKey("parks.id", ondelete="CASCADE"), nullable=True),
        sa.Column("type", sa.String(length=32), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="active"),
        sa.Column("provider_payment_id", sa.String(length=120), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_subscriptions_expires_at", "subscriptions", ["expires_at"])
    op.create_index("ix_subscriptions_owner_status", "subscriptions", ["user_id", "park_id", "status"])
    op.create_index("ix_subscriptions_park_id", "subscriptions", ["park_id"])
    op.create_index("ix_subscriptions_provider_payment_id", "subscriptions", ["provider_payment_id"])
    op.create_index("ix_subscriptions_status", "subscriptions", ["status"])
    op.create_index("ix_subscriptions_type", "subscriptions", ["type"])
    op.create_index("ix_subscriptions_user_id", "subscriptions", ["user_id"])

    op.execute("ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS role text")
    op.execute("ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS park_id text")
    op.execute("ALTER TABLE IF EXISTS drivers ADD COLUMN IF NOT EXISTS employment_type text")
    op.execute("ALTER TABLE IF EXISTS drivers ADD COLUMN IF NOT EXISTS park_id text")
    op.execute("ALTER TABLE IF EXISTS drivers ADD COLUMN IF NOT EXISTS park_driver_status text")
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'drivers' AND column_name = 'billing_mode'
            ) THEN
                COMMENT ON COLUMN drivers.billing_mode IS
                    'Deprecated: use subscriptions.type; all new roles use 0% commission monthly subscriptions';
            END IF;
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'drivers' AND column_name = 'commission_percent'
            ) THEN
                COMMENT ON COLUMN drivers.commission_percent IS
                    'Deprecated: per-order commission is disabled for the new role model';
            END IF;
        END $$;
        """,
    )
    op.execute("ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS surge_coefficient numeric(4,2) DEFAULT 1")
    op.execute("ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS batch_id text")
    op.execute("ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS quote_id text")
    op.execute("ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS fulfilled_by_role text")
    op.execute("ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS park_id text")


def downgrade() -> None:
    """Drop logistics-owned tables and additive columns."""

    op.execute("ALTER TABLE IF EXISTS orders DROP COLUMN IF EXISTS quote_id")
    op.execute("ALTER TABLE IF EXISTS orders DROP COLUMN IF EXISTS batch_id")
    op.execute("ALTER TABLE IF EXISTS orders DROP COLUMN IF EXISTS surge_coefficient")
    op.execute("ALTER TABLE IF EXISTS orders DROP COLUMN IF EXISTS fulfilled_by_role")
    op.execute("ALTER TABLE IF EXISTS orders DROP COLUMN IF EXISTS park_id")
    op.drop_table("subscriptions")
    op.drop_table("park_vehicles")
    op.drop_table("park_drivers")
    op.drop_table("parks")
    op.drop_table("driver_balances")
    op.drop_table("finance_events")
    op.drop_table("address_points")
    op.drop_table("dispatch_events")
    op.drop_table("surge_logs")
