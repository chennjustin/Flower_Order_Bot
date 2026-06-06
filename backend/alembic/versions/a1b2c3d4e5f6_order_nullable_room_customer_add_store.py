"""order: nullable room_id/customer_id, add store_id

Revision ID: a1b2c3d4e5f6
Revises: f4e8bb2a9031
Create Date: 2026-06-06

Allow orders to be created directly without a chat room (manual entry from
the orders management page). room_id and customer_id become nullable.
A store_id column is added so that store-scoped queries still work when
room_id is NULL.
"""

from alembic import op
import sqlalchemy as sa


revision = "a1b2c3d4e5f6"
down_revision = ("f4e8bb2a9031", "b3c4d5e6f7a8")
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Make room_id and customer_id nullable
    op.alter_column("order", "room_id", existing_type=sa.Integer(), nullable=True)
    op.alter_column("order", "customer_id", existing_type=sa.Integer(), nullable=True)

    # 2. Add store_id (nullable; back-fill via join below)
    op.add_column(
        "order",
        sa.Column("store_id", sa.Integer(), sa.ForeignKey("store.id", ondelete="RESTRICT"), nullable=True),
    )

    # 3. Back-fill store_id for existing orders from their chat room
    op.execute(
        sa.text(
            "UPDATE \"order\" o "
            "SET store_id = cr.store_id "
            "FROM chat_room cr "
            "WHERE o.room_id = cr.id AND o.store_id IS NULL"
        )
    )


def downgrade() -> None:
    op.drop_column("order", "store_id")
    op.alter_column("order", "customer_id", existing_type=sa.Integer(), nullable=False)
    op.alter_column("order", "room_id", existing_type=sa.Integer(), nullable=False)
