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


def upgrade() -> None:
    op.add_column(
        'store',
        sa.Column('onboarding_done', sa.Boolean(), nullable=False, server_default='false'),
    )


def downgrade() -> None:
    op.drop_column('store', 'onboarding_done')
