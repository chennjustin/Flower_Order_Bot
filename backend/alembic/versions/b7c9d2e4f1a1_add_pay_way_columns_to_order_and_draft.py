"""add pay_way columns to order and order_draft

Revision ID: b7c9d2e4f1a1
Revises: 8b1d2c3f4a56
Create Date: 2026-05-28 23:45:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "b7c9d2e4f1a1"
down_revision = "8b1d2c3f4a56"
branch_labels = None
depends_on = None


def _has_column(insp: sa.Inspector, table_name: str, column_name: str) -> bool:
    return any(col["name"] == column_name for col in insp.get_columns(table_name, schema="public"))


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if not _has_column(insp, "order_draft", "pay_way"):
        op.add_column("order_draft", sa.Column("pay_way", sa.String(), nullable=True))

    if not _has_column(insp, "order", "pay_way"):
        op.add_column("order", sa.Column("pay_way", sa.String(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if _has_column(insp, "order", "pay_way"):
        op.drop_column("order", "pay_way")

    if _has_column(insp, "order_draft", "pay_way"):
        op.drop_column("order_draft", "pay_way")
