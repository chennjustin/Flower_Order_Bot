"""add FULFILLED to order_status enum

Revision ID: e8f7a6b5c4d3
Revises: c9d8e7f6a5b4
Create Date: 2026-06-07
"""

from __future__ import annotations

from alembic import op

revision = "e8f7a6b5c4d3"
down_revision = "c9d8e7f6a5b4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PostgreSQL enum extension; IF NOT EXISTS keeps re-runs idempotent.
    op.execute("ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'FULFILLED'")


def downgrade() -> None:
    # PostgreSQL does not support removing individual enum values safely.
    pass
