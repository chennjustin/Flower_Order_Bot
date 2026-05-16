"""add_chat_sticker_columns

Revision ID: c3b8e1a9d0f2
Revises: d42d661dc523
Create Date: 2025-01-01

"""

from alembic import op
import sqlalchemy as sa


revision = "c3b8e1a9d0f2"
down_revision = "d42d661dc523"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "chat_message", sa.Column("sticker_package_id", sa.String(), nullable=True)
    )
    op.add_column("chat_message", sa.Column("sticker_id", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("chat_message", "sticker_id")
    op.drop_column("chat_message", "sticker_package_id")
