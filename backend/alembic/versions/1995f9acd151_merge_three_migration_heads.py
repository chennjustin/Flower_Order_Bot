"""merge three migration heads

Revision ID: 1995f9acd151
Revises: a1b2c3d4e5f6, c4d5e6f7a8b9, e8f7a6b5c4d3
Create Date: 2026-06-07 11:01:05.133429

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '1995f9acd151'
down_revision = ('a1b2c3d4e5f6', 'c4d5e6f7a8b9', 'e8f7a6b5c4d3')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
