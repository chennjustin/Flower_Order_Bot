"""add store LINE channel credentials

Revision ID: f1a2b3c4d5e6
Revises: e2f1a4b5c6d7
Create Date: 2026-06-04

store.slug holds LINE webhook destination (channel user id).
"""

from alembic import op
import sqlalchemy as sa


revision = "f1a2b3c4d5e6"
down_revision = "a9f3c2d1e4b7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "store",
        sa.Column("line_channel_access_token", sa.String(), nullable=True),
    )
    op.add_column(
        "store",
        sa.Column("line_channel_secret", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("store", "line_channel_secret")
    op.drop_column("store", "line_channel_access_token")
