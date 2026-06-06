"""add pay_status columns to order and order_draft

Revision ID: c1d4e7f9a2b3
Revises: b7c9d2e4f1a1
Create Date: 2026-05-29 00:05:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "c1d4e7f9a2b3"
down_revision = "b7c9d2e4f1a1"
branch_labels = None
depends_on = None


def _has_column(insp: sa.Inspector, table_name: str, column_name: str) -> bool:
    return any(col["name"] == column_name for col in insp.get_columns(table_name, schema="public"))


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    payment_status_enum = postgresql.ENUM(
        "PENDING",
        "PAID",
        "FAILED",
        "REFUNDED",
        name="payment_status",
        create_type=False,
    )

    if not _has_column(insp, "order_draft", "pay_status"):
        op.add_column("order_draft", sa.Column("pay_status", payment_status_enum, nullable=True))

    if not _has_column(insp, "order", "pay_status"):
        op.add_column("order", sa.Column("pay_status", payment_status_enum, nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if _has_column(insp, "order", "pay_status"):
        op.drop_column("order", "pay_status")

    if _has_column(insp, "order_draft", "pay_status"):
        op.drop_column("order_draft", "pay_status")
