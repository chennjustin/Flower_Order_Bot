"""add store display config and indexes

Revision ID: 2f9a0d4c1b7e
Revises: c3b8e1a9d0f2
Create Date: 2026-05-02 20:05:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "2f9a0d4c1b7e"
down_revision = "c3b8e1a9d0f2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names(schema="public")

    # 資料庫可能曾手動跑過或以不同 revision 狀態已存在表／索引（避免 DuplicateTable）。
    if "store_display_config" not in tables:
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

    def index_names(table: str) -> set[str]:
        if table not in tables:
            return set()
        return {ix["name"] for ix in insp.get_indexes(table, schema="public")}

    ix_chat = index_names("chat_message")
    if "ix_chat_message_room_id_created_at" not in ix_chat:
        op.create_index(
            "ix_chat_message_room_id_created_at",
            "chat_message",
            ["room_id", "created_at"],
            unique=False,
        )

    ix_room = index_names("chat_room")
    if "ix_chat_room_user_id" not in ix_room:
        op.create_index("ix_chat_room_user_id", "chat_room", ["user_id"], unique=False)

    ix_order_tbl = index_names("order")
    if "ix_order_room_id_status_created_at" not in ix_order_tbl:
        op.create_index(
            "ix_order_room_id_status_created_at",
            "order",
            ["room_id", "status", "created_at"],
            unique=False,
        )

    ix_draft = index_names("order_draft")
    if "ix_order_draft_room_id" not in ix_draft:
        op.create_index("ix_order_draft_room_id", "order_draft", ["room_id"], unique=False)

    ix_pay = index_names("payment")
    if "ix_payment_order_id_method_id" not in ix_pay:
        op.create_index(
            "ix_payment_order_id_method_id", "payment", ["order_id", "method_id"], unique=False
        )


def downgrade() -> None:
    op.drop_index("ix_payment_order_id_method_id", table_name="payment")
    op.drop_index("ix_order_draft_room_id", table_name="order_draft")
    op.drop_index("ix_order_room_id_status_created_at", table_name="order")
    op.drop_index("ix_chat_room_user_id", table_name="chat_room")
    op.drop_index("ix_chat_message_room_id_created_at", table_name="chat_message")
    op.drop_table("store_display_config")

