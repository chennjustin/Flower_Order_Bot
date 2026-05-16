"""local customer alignment for order_draft

Revision ID: 9f4c2a8b7d11
Revises: c3b8e1a9d0f2
Create Date: 2026-05-16 19:10:00.000000

This migration is intentionally local-first:
- Add `customer` table matching the planned deployment schema.
- Add `order_draft.customer_id` and backfill from legacy `order_draft.user_id`.
- Keep legacy columns for backward compatibility with current backend code.
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "9f4c2a8b7d11"
down_revision = "c3b8e1a9d0f2"
branch_labels = None
depends_on = None


def _has_table(inspector: sa.Inspector, table_name: str) -> bool:
    return table_name in inspector.get_table_names()


def _has_column(inspector: sa.Inspector, table_name: str, column_name: str) -> bool:
    return any(col["name"] == column_name for col in inspector.get_columns(table_name))


def _has_fk(inspector: sa.Inspector, table_name: str, fk_name: str) -> bool:
    return any(fk.get("name") == fk_name for fk in inspector.get_foreign_keys(table_name))


def _has_index(inspector: sa.Inspector, table_name: str, index_name: str) -> bool:
    return any(idx.get("name") == index_name for idx in inspector.get_indexes(table_name))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # Local scaffold for the planned customer->store FK.
    if not _has_table(inspector, "store"):
        op.create_table(
            "store",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
        )
        op.execute(
            sa.text(
                """
                INSERT INTO store (name, created_at, updated_at)
                VALUES ('Local Default Store', NOW(), NOW())
                """
            )
        )

    default_store_id = bind.execute(
        sa.text("SELECT id FROM store ORDER BY id LIMIT 1")
    ).scalar_one()

    inspector = sa.inspect(bind)
    if not _has_table(inspector, "customer"):
        op.create_table(
            "customer",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("line_uid", sa.String(), nullable=True),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("phone", sa.String(), nullable=True),
            sa.Column("avatar_url", sa.String(), nullable=True),
            sa.Column("has_ordered", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.Column("store_id", sa.Integer(), nullable=False),
            sa.ForeignKeyConstraint(["store_id"], ["store.id"], ondelete="CASCADE", name="customer_store_id_fkey"),
            sa.UniqueConstraint("line_uid", name="customer_line_uid_key"),
            sa.PrimaryKeyConstraint("id", name="customer_pkey"),
        )

    # Backfill customer rows from legacy user table (id-preserving).
    inspector = sa.inspect(bind)
    if _has_table(inspector, "user"):
        bind.execute(
            sa.text(
                """
                INSERT INTO customer (
                    id, line_uid, name, phone, avatar_url, has_ordered, created_at, updated_at, store_id
                )
                SELECT
                    u.id, u.line_uid, u.name, u.phone, u.avatar_url, u.has_ordered, u.created_at, u.updated_at, :store_id
                FROM "user" AS u
                WHERE NOT EXISTS (
                    SELECT 1 FROM customer c WHERE c.id = u.id
                )
                """
            ),
            {"store_id": default_store_id},
        )

        # Sync serial sequence after id-preserving insert.
        op.execute(
            sa.text(
                """
                SELECT setval(
                    pg_get_serial_sequence('customer', 'id'),
                    GREATEST((SELECT COALESCE(MAX(id), 1) FROM customer), 1),
                    true
                )
                """
            )
        )

    inspector = sa.inspect(bind)
    if not _has_column(inspector, "order_draft", "customer_id"):
        op.add_column("order_draft", sa.Column("customer_id", sa.Integer(), nullable=True))

    # Backfill from legacy user_id when available.
    if _has_column(inspector, "order_draft", "user_id"):
        op.execute(
            sa.text(
                """
                UPDATE order_draft
                SET customer_id = user_id
                WHERE customer_id IS NULL
                """
            )
        )

    op.alter_column("order_draft", "customer_id", nullable=False)

    inspector = sa.inspect(bind)
    if not _has_fk(inspector, "order_draft", "order_draft_customer_id_fkey"):
        op.create_foreign_key(
            "order_draft_customer_id_fkey",
            "order_draft",
            "customer",
            ["customer_id"],
            ["id"],
            ondelete="RESTRICT",
        )

    if not _has_index(inspector, "order_draft", "ix_order_draft_room_id"):
        op.create_index("ix_order_draft_room_id", "order_draft", ["room_id"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if _has_fk(inspector, "order_draft", "order_draft_customer_id_fkey"):
        op.drop_constraint("order_draft_customer_id_fkey", "order_draft", type_="foreignkey")

    inspector = sa.inspect(bind)
    if _has_column(inspector, "order_draft", "customer_id"):
        op.drop_column("order_draft", "customer_id")

    inspector = sa.inspect(bind)
    if _has_table(inspector, "customer"):
        op.drop_table("customer")

    inspector = sa.inspect(bind)
    if _has_table(inspector, "store"):
        op.drop_table("store")
