"""add store owner_display_name

Revision ID: c9d8e7f6a5b4
Revises: b3c4d5e6f7a8
Create Date: 2026-06-06
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "c9d8e7f6a5b4"
down_revision = "b3c4d5e6f7a8"
branch_labels = None
depends_on = None

TABLE = "store"
COLUMN = "owner_display_name"


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if TABLE not in insp.get_table_names(schema="public"):
        return

    cols = {c["name"] for c in insp.get_columns(TABLE, schema="public")}
    if COLUMN not in cols:
        op.add_column(TABLE, sa.Column(COLUMN, sa.String(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if TABLE not in insp.get_table_names(schema="public"):
        return

    cols = {c["name"] for c in insp.get_columns(TABLE, schema="public")}
    if COLUMN in cols:
        op.drop_column(TABLE, COLUMN)
