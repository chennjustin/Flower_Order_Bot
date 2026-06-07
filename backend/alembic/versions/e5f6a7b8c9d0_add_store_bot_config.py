"""add store bot config

Revision ID: e5f6a7b8c9d0
Revises: a1b2c3d4e5f6, c9d8e7f6a5b4
Create Date: 2026-06-06 22:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "e5f6a7b8c9d0"
down_revision = ("a1b2c3d4e5f6", "c9d8e7f6a5b4")
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "store_bot_config" in insp.get_table_names(schema="public"):
        return

    op.create_table(
        "store_bot_config",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("store_id", sa.Integer(), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("config", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["store_id"], ["store.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("store_id"),
    )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "store_bot_config" in insp.get_table_names(schema="public"):
        op.drop_table("store_bot_config")
