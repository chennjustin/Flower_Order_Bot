"""add chat_message sticker columns

Revision ID: c3b8e1a9d0f2
Revises: 2f9a0d4c1b7e
Create Date: 2026-05-16 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "c3b8e1a9d0f2"
down_revision = "2f9a0d4c1b7e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "chat_message",
        sa.Column("sticker_package_id", sa.String(), nullable=True),
    )
    op.add_column(
        "chat_message",
        sa.Column("sticker_id", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("chat_message", "sticker_id")
    op.drop_column("chat_message", "sticker_package_id")
