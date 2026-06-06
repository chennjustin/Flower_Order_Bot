"""multitenant schema (store, customer, simplified order)

Revision ID: f4e8bb2a9031
Revises: 2f9a0d4c1b7e
Create Date: 2026-05-17

WARNING: 此 revision 會 DROP 舊表（含資料），僅適合開發／有意清空庫時使用。
- owner_auth_user_id：一般 Postgres 無 auth.uid()，此處為 NOT NULL 無預設，插入 store 時須提供 UUID。
  Supabase 若要 DEFAULT auth.uid()，請另外在 SQL Editor：`ALTER TABLE public.store ALTER COLUMN owner_auth_user_id SET DEFAULT auth.uid();`
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "f4e8bb2a9031"
down_revision = "2f9a0d4c1b7e"
branch_labels = None
depends_on = None


def _drop_legacy_tables() -> None:
    op.execute(sa.text('DROP TABLE IF EXISTS public.payment CASCADE'))
    op.execute(sa.text('DROP TABLE IF EXISTS public."order" CASCADE'))
    op.execute(sa.text("DROP TABLE IF EXISTS public.order_draft CASCADE"))
    op.execute(sa.text("DROP TABLE IF EXISTS public.chat_message CASCADE"))
    op.execute(sa.text("DROP TABLE IF EXISTS public.chat_room CASCADE"))
    op.execute(sa.text("DROP TABLE IF EXISTS public.notification CASCADE"))
    op.execute(sa.text("DROP TABLE IF EXISTS public.payment_method CASCADE"))
    op.execute(sa.text("DROP TABLE IF EXISTS public.customer CASCADE"))
    op.execute(sa.text("DROP TABLE IF EXISTS public.store CASCADE"))
    op.execute(sa.text("DROP TABLE IF EXISTS public.store_display_config CASCADE"))
    op.execute(sa.text("DROP TABLE IF EXISTS public.audit_log CASCADE"))
    op.execute(sa.text("DROP TABLE IF EXISTS public.staff_user CASCADE"))
    op.execute(sa.text('DROP TABLE IF EXISTS public."user" CASCADE'))


def _drop_legacy_enums() -> None:
    names = (
        "chat_message_direction",
        "chat_message_status",
        "chat_room_stage",
        "notification_channel",
        "notification_receiver_type",
        "notification_status",
        "order_status",
        "payment_status",
        "shipment_method",
        "shipment_status",
        "staff_role",
    )
    for name in names:
        op.execute(sa.text(f"DROP TYPE IF EXISTS public.{name} CASCADE"))


def upgrade() -> None:
    _drop_legacy_tables()
    _drop_legacy_enums()

    op.execute(
        sa.text(
            "CREATE TYPE public.chat_message_direction AS ENUM "
            "('INCOMING', 'OUTGOING_BY_BOT', 'OUTGOING_BY_STORE')"
        )
    )
    op.execute(
        sa.text(
            "CREATE TYPE public.chat_message_status AS ENUM "
            "('SENT', 'PENDING', 'FAILED')"
        )
    )
    op.execute(
        sa.text(
            "CREATE TYPE public.chat_room_stage AS ENUM "
            "('WELCOME', 'IDLE', 'ORDER_CONFIRM', 'WAITING_OWNER', 'BOT_ACTIVE')"
        )
    )
    op.execute(
        sa.text(
            "CREATE TYPE public.notification_channel AS ENUM ('LINE', 'EMAIL', 'SMS')"
        )
    )
    op.execute(
        sa.text(
            "CREATE TYPE public.notification_status AS ENUM "
            "('QUEUED', 'SENT', 'FAILED')"
        )
    )
    op.execute(
        sa.text(
            "CREATE TYPE public.order_status AS ENUM "
            "('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED')"
        )
    )
    op.execute(
        sa.text(
            "CREATE TYPE public.payment_status AS ENUM "
            "('PENDING', 'PAID', 'FAILED', 'REFUNDED')"
        )
    )
    op.execute(
        sa.text(
            "CREATE TYPE public.shipment_method AS ENUM "
            "('STORE_PICKUP', 'DELIVERY')"
        )
    )

    chat_message_direction_e = postgresql.ENUM(
        "INCOMING",
        "OUTGOING_BY_BOT",
        "OUTGOING_BY_STORE",
        name="chat_message_direction",
        create_type=False,
    )
    chat_message_status_e = postgresql.ENUM(
        "SENT",
        "PENDING",
        "FAILED",
        name="chat_message_status",
        create_type=False,
    )
    chat_room_stage_e = postgresql.ENUM(
        "WELCOME",
        "IDLE",
        "ORDER_CONFIRM",
        "WAITING_OWNER",
        "BOT_ACTIVE",
        name="chat_room_stage",
        create_type=False,
    )
    notification_channel_e = postgresql.ENUM(
        "LINE",
        "EMAIL",
        "SMS",
        name="notification_channel",
        create_type=False,
    )
    notification_status_e = postgresql.ENUM(
        "QUEUED",
        "SENT",
        "FAILED",
        name="notification_status",
        create_type=False,
    )
    order_status_e = postgresql.ENUM(
        "PENDING",
        "CONFIRMED",
        "CANCELLED",
        "COMPLETED",
        name="order_status",
        create_type=False,
    )
    payment_status_e = postgresql.ENUM(
        "PENDING",
        "PAID",
        "FAILED",
        "REFUNDED",
        name="payment_status",
        create_type=False,
    )
    shipment_method_e = postgresql.ENUM(
        "STORE_PICKUP",
        "DELIVERY",
        name="shipment_method",
        create_type=False,
    )

    op.create_table(
        "store",
        sa.Column("id", sa.Integer(), nullable=False, autoincrement=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("slug", sa.String(), nullable=True),
        sa.Column(
            "timezone",
            sa.String(),
            nullable=False,
            server_default=sa.text("'Asia/Taipei'"),
        ),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=False), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=False), nullable=False),
        sa.Column("owner_auth_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )

    op.create_table(
        "customer",
        sa.Column("id", sa.Integer(), nullable=False, autoincrement=True),
        sa.Column("line_uid", sa.String(), nullable=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("phone", sa.String(), nullable=True),
        sa.Column("avatar_url", sa.String(), nullable=True),
        sa.Column("has_ordered", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=False), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=False), nullable=False),
        sa.Column("store_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["store_id"], ["store.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("store_id", "line_uid", name="uq_customer_store_line_uid"),
    )

    op.create_table(
        "chat_room",
        sa.Column("id", sa.Integer(), nullable=False, autoincrement=True),
        sa.Column("store_id", sa.Integer(), nullable=False),
        sa.Column("customer_id", sa.Integer(), nullable=False),
        sa.Column("stage", chat_room_stage_e, nullable=False),
        sa.Column(
            "bot_step",
            sa.SmallInteger(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column("last_message_ts", sa.DateTime(timezone=False), nullable=True),
        sa.Column(
            "unread_count",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column("created_at", sa.DateTime(timezone=False), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=False), nullable=False),
        sa.ForeignKeyConstraint(["store_id"], ["store.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["customer_id"], ["customer.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "chat_message",
        sa.Column("id", sa.Integer(), nullable=False, autoincrement=True),
        sa.Column("room_id", sa.Integer(), nullable=False),
        sa.Column("status", chat_message_status_e, nullable=False),
        sa.Column("direction", chat_message_direction_e, nullable=False),
        sa.Column("text", sa.Text(), nullable=True),
        sa.Column("image_url", sa.Text(), nullable=True),
        sa.Column("line_msg_id", sa.String(), nullable=True),
        sa.Column(
            "processed",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column("sticker_package_id", sa.String(), nullable=True),
        sa.Column("sticker_id", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=False), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=False), nullable=False),
        sa.ForeignKeyConstraint(["room_id"], ["chat_room.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "payment_method",
        sa.Column("id", sa.Integer(), nullable=False, autoincrement=True),
        sa.Column("store_id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(), nullable=False),
        sa.Column("display_name", sa.String(), nullable=False),
        sa.Column("display_image_url", sa.Text(), nullable=True),
        sa.Column("instructions", sa.Text(), nullable=True),
        sa.Column("requires_manual_confirm", sa.Boolean(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["store_id"], ["store.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("store_id", "code", name="uq_payment_method_store_code"),
    )

    op.create_table(
        "order_draft",
        sa.Column("id", sa.Integer(), nullable=False, autoincrement=True),
        sa.Column("room_id", sa.Integer(), nullable=False),
        sa.Column("customer_id", sa.Integer(), nullable=False),
        sa.Column("item_type", sa.String(), nullable=True),
        sa.Column("quantity", sa.Integer(), nullable=True),
        sa.Column("total_amount", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("shipment_method", shipment_method_e, nullable=True),
        sa.Column("delivery_address", sa.Text(), nullable=True),
        sa.Column("delivery_datetime", sa.DateTime(timezone=False), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=False), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=False), nullable=False),
        sa.ForeignKeyConstraint(["room_id"], ["chat_room.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["customer_id"], ["customer.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "order",
        sa.Column("id", sa.Integer(), nullable=False, autoincrement=True),
        sa.Column("room_id", sa.Integer(), nullable=False),
        sa.Column("customer_id", sa.Integer(), nullable=False),
        sa.Column("status", order_status_e, nullable=False),
        sa.Column("item_type", sa.String(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=True),
        sa.Column("total_amount", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("shipment_method", shipment_method_e, nullable=True),
        sa.Column("delivery_address", sa.Text(), nullable=True),
        sa.Column("delivery_datetime", sa.DateTime(timezone=False), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=False), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=False), nullable=False),
        sa.ForeignKeyConstraint(["room_id"], ["chat_room.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["customer_id"], ["customer.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "payment",
        sa.Column("id", sa.Integer(), nullable=False, autoincrement=True),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("status", payment_status_e, nullable=False),
        sa.Column("method_id", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("screenshot_url", sa.Text(), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=False), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(timezone=False), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=False), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=False), nullable=False),
        sa.ForeignKeyConstraint(["order_id"], ["order.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["method_id"], ["payment_method.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "notification",
        sa.Column("id", sa.Integer(), nullable=False, autoincrement=True),
        sa.Column("receiver_customer_id", sa.Integer(), nullable=False),
        sa.Column("channel", notification_channel_e, nullable=False),
        sa.Column("status", notification_status_e, nullable=False),
        sa.Column("send_at", sa.DateTime(timezone=False), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=False), nullable=False),
        sa.ForeignKeyConstraint(["receiver_customer_id"], ["customer.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_chat_message_room_id_created_at",
        "chat_message",
        ["room_id", "created_at"],
        unique=False,
    )
    op.create_index("ix_chat_room_store_id", "chat_room", ["store_id"], unique=False)
    op.create_index("ix_chat_room_customer_id", "chat_room", ["customer_id"], unique=False)
    op.create_index(
        "ix_order_room_id_status_created_at",
        "order",
        ["room_id", "status", "created_at"],
        unique=False,
    )
    op.create_index("ix_order_draft_room_id", "order_draft", ["room_id"], unique=False)
    op.create_index("ix_payment_order_id_method_id", "payment", ["order_id", "method_id"], unique=False)
    op.create_index(
        "ix_payment_method_store_id",
        "payment_method",
        ["store_id"],
        unique=False,
    )


def downgrade() -> None:
    raise NotImplementedError(
        "f4e8bb2a9031 會刪除舊 schema 並重建此套多租戶表；不提供還原到舊 user/staff 結構。"
        " 請自備資料庫備份或沿用 upgrade 之前的 dump。"
    )
