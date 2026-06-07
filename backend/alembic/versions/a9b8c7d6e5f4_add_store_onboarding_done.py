"""add store.onboarding_done

Revision ID: a9b8c7d6e5f4
Revises: c9d8e7f6a5b4
Create Date: 2026-06-06

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = 'a9b8c7d6e5f4'
down_revision = ('e5f6a7b8c9d0', 'c4d5e6f7a8b9')
branch_labels = None
depends_on = None


def _has_column(insp: sa.Inspector, table: str, column: str) -> bool:
    if table not in insp.get_table_names(schema="public"):
        return False
    return column in {c["name"] for c in insp.get_columns(table, schema="public")}


def upgrade() -> None:
    # Idempotent: the column may already exist if the schema was patched
    # manually (Supabase SQL editor) before alembic was stamped.
    insp = sa.inspect(op.get_bind())
    if not _has_column(insp, "store", "onboarding_done"):
        op.add_column(
            'store',
            sa.Column('onboarding_done', sa.Boolean(), nullable=False, server_default='false'),
        )


def downgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if _has_column(insp, "store", "onboarding_done"):
        op.drop_column('store', 'onboarding_done')
