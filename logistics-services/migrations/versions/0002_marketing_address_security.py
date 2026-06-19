"""Add marketing partner and editable address layer fields.

Revision ID: 0002_marketing_address_security
Revises: 0001_logistics_tables
Create Date: 2026-05-27
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002_marketing_address_security"
down_revision: str | None = "0001_logistics_tables"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create marketing tables and extend address points for location contracts."""

    op.add_column("address_points", sa.Column("marketer_id", sa.String(length=96), nullable=True))
    op.add_column("address_points", sa.Column("contract_status", sa.String(length=32), nullable=False, server_default="draft"))
    op.add_column("address_points", sa.Column("qr_code_id", sa.String(length=96), nullable=True))
    op.add_column("address_points", sa.Column("install_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("address_points", sa.Column("monthly_install_count", sa.Integer(), nullable=False, server_default="0"))
    op.create_index("ix_address_points_contract_status", "address_points", ["contract_status"])
    op.create_index("ix_address_points_marketer_id", "address_points", ["marketer_id"])
    op.create_index("ix_address_points_qr_code_id", "address_points", ["qr_code_id"])

    op.create_table(
        "marketing_levels",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(length=32), nullable=False, unique=True),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("min_points", sa.Integer(), nullable=False),
        sa.Column("max_points", sa.Integer(), nullable=True),
        sa.Column("coefficient", sa.Numeric(4, 2), nullable=False, server_default="1.00"),
    )
    op.bulk_insert(
        sa.table(
            "marketing_levels",
            sa.column("id", sa.Integer()),
            sa.column("code", sa.String()),
            sa.column("name", sa.String()),
            sa.column("min_points", sa.Integer()),
            sa.column("max_points", sa.Integer()),
            sa.column("coefficient", sa.Numeric()),
        ),
        [
            {"id": 1, "code": "herald", "name": "Глашатай", "min_points": 0, "max_points": 3000, "coefficient": 1},
            {"id": 2, "code": "negotiator", "name": "Переговорщик", "min_points": 3001, "max_points": 10000, "coefficient": 2},
            {"id": 3, "code": "maloyaz_legend", "name": "Легенда Малояза", "min_points": 10001, "max_points": None, "coefficient": 3},
        ],
    )

    op.create_table(
        "marketing_partners",
        sa.Column("id", sa.String(length=48), primary_key=True),
        sa.Column("user_id", sa.String(length=96), nullable=False),
        sa.Column("name", sa.String(length=180), nullable=False),
        sa.Column("phone", sa.String(length=32), nullable=True),
        sa.Column("email", sa.String(length=180), nullable=True),
        sa.Column("invite_code", sa.String(length=64), nullable=False),
        sa.Column("balance_points", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("base_earned_points", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("paid_out_points", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("total_earned_points", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("level_id", sa.Integer(), sa.ForeignKey("marketing_levels.id"), nullable=False, server_default="1"),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("invite_code", name="uq_marketing_partners_invite_code"),
        sa.UniqueConstraint("user_id", name="uq_marketing_partners_user_id"),
    )
    op.create_index("ix_marketing_partners_invite_code", "marketing_partners", ["invite_code"])
    op.create_index("ix_marketing_partners_status", "marketing_partners", ["status"])
    op.create_index("ix_marketing_partners_status_level", "marketing_partners", ["status", "level_id"])
    op.create_index("ix_marketing_partners_user_id", "marketing_partners", ["user_id"])

    op.create_table(
        "marketing_actions",
        sa.Column("id", sa.String(length=48), primary_key=True),
        sa.Column("marketer_id", sa.String(length=48), sa.ForeignKey("marketing_partners.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.String(length=64), nullable=False),
        sa.Column("source_id", sa.String(length=120), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="rewarded"),
        sa.Column("base_points", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("points", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("description", sa.String(length=500), nullable=False, server_default=""),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("marketer_id", "type", "source_id", name="uq_marketing_actions_source"),
    )
    op.create_index("ix_marketing_actions_created_at", "marketing_actions", ["created_at"])
    op.create_index("ix_marketing_actions_marketer_id", "marketing_actions", ["marketer_id"])
    op.create_index("ix_marketing_actions_marketer_status", "marketing_actions", ["marketer_id", "status"])
    op.create_index("ix_marketing_actions_source_id", "marketing_actions", ["source_id"])
    op.create_index("ix_marketing_actions_status", "marketing_actions", ["status"])
    op.create_index("ix_marketing_actions_type", "marketing_actions", ["type"])


def downgrade() -> None:
    """Drop marketing tables and address layer extensions."""

    op.drop_index("ix_marketing_actions_type", table_name="marketing_actions")
    op.drop_index("ix_marketing_actions_status", table_name="marketing_actions")
    op.drop_index("ix_marketing_actions_source_id", table_name="marketing_actions")
    op.drop_index("ix_marketing_actions_marketer_status", table_name="marketing_actions")
    op.drop_index("ix_marketing_actions_marketer_id", table_name="marketing_actions")
    op.drop_index("ix_marketing_actions_created_at", table_name="marketing_actions")
    op.drop_table("marketing_actions")
    op.drop_index("ix_marketing_partners_user_id", table_name="marketing_partners")
    op.drop_index("ix_marketing_partners_status_level", table_name="marketing_partners")
    op.drop_index("ix_marketing_partners_status", table_name="marketing_partners")
    op.drop_index("ix_marketing_partners_invite_code", table_name="marketing_partners")
    op.drop_table("marketing_partners")
    op.drop_table("marketing_levels")
    op.drop_index("ix_address_points_qr_code_id", table_name="address_points")
    op.drop_index("ix_address_points_marketer_id", table_name="address_points")
    op.drop_index("ix_address_points_contract_status", table_name="address_points")
    op.drop_column("address_points", "monthly_install_count")
    op.drop_column("address_points", "install_count")
    op.drop_column("address_points", "qr_code_id")
    op.drop_column("address_points", "contract_status")
    op.drop_column("address_points", "marketer_id")
