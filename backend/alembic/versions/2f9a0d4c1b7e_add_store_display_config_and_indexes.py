"""add store display config and indexes

Revision ID: 2f9a0d4c1b7e
Revises: d42d661dc523
Create Date: 2026-05-02 20:05:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "2f9a0d4c1b7e"
down_revision = "d42d661dc523"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "store_display_config",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("store_key", sa.String(), nullable=False),
        sa.Column("visible_fields", sa.JSON(), nullable=True),
        sa.Column("updated_by_staff_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["updated_by_staff_id"], ["staff_user.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("store_key"),
    )

    op.create_index(
        "ix_chat_message_room_id_created_at", "chat_message", ["room_id", "created_at"], unique=False
    )
    op.create_index("ix_chat_room_user_id", "chat_room", ["user_id"], unique=False)
    op.create_index(
        "ix_order_room_id_status_created_at", "order", ["room_id", "status", "created_at"], unique=False
    )
    op.create_index("ix_order_draft_room_id", "order_draft", ["room_id"], unique=False)
    op.create_index("ix_payment_order_id_method_id", "payment", ["order_id", "method_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_payment_order_id_method_id", table_name="payment")
    op.drop_index("ix_order_draft_room_id", table_name="order_draft")
    op.drop_index("ix_order_room_id_status_created_at", table_name="order")
    op.drop_index("ix_chat_room_user_id", table_name="chat_room")
    op.drop_index("ix_chat_message_room_id_created_at", table_name="chat_message")
    op.drop_table("store_display_config")

