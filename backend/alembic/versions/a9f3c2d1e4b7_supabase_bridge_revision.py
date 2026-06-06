"""bridge revision recorded on Supabase (not in earlier repo commits)

Revision ID: a9f3c2d1e4b7
Revises: e2f1a4b5c6d7
Create Date: 2026-06-04

No schema changes — aligns local Alembic graph with existing alembic_version rows.
"""

from alembic import op


revision = "a9f3c2d1e4b7"
down_revision = "e2f1a4b5c6d7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
