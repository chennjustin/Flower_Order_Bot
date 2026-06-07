"""merge onboarding and calendar heads

Revision ID: b23f96447f12
Revises: 1995f9acd151, a9b8c7d6e5f4
Create Date: 2026-06-07 15:24:28.143499

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b23f96447f12'
down_revision = ('1995f9acd151', 'a9b8c7d6e5f4')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
