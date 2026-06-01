"""add customer snapshot columns to order

Revision ID: d4e5f6a7b8c9
Revises: c1d4e7f9a2b3
Create Date: 2026-05-29 00:20:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "d4e5f6a7b8c9"
down_revision = "c1d4e7f9a2b3"
branch_labels = None
depends_on = None


def _has_column(insp: sa.Inspector, table_name: str, column_name: str) -> bool:
    return any(col["name"] == column_name for col in insp.get_columns(table_name, schema="public"))


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if not _has_column(insp, "order", "customer_name"):
        op.add_column("order", sa.Column("customer_name", sa.String(), nullable=True))
    if not _has_column(insp, "order", "customer_phone"):
        op.add_column("order", sa.Column("customer_phone", sa.String(), nullable=True))

    op.execute(
        sa.text(
            """
            UPDATE public."order" o
            SET
              customer_name = COALESCE(o.customer_name, c.name),
              customer_phone = COALESCE(o.customer_phone, c.phone)
            FROM public.customer c
            WHERE o.customer_id = c.id
            """
        )
    )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if _has_column(insp, "order", "customer_phone"):
        op.drop_column("order", "customer_phone")
    if _has_column(insp, "order", "customer_name"):
        op.drop_column("order", "customer_name")
