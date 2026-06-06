"""add store_order_field_config table

Revision ID: 8b1d2c3f4a56
Revises: f4e8bb2a9031
Create Date: 2026-05-27 12:45:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "8b1d2c3f4a56"
down_revision = "f4e8bb2a9031"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names(schema="public")
    if "store_order_field_config" in tables:
        return

    op.create_table(
        "store_order_field_config",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("store_id", sa.Integer(), nullable=False),
        sa.Column("visible_fields", sa.JSON(), nullable=False),
        sa.Column("organize_required_fields", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["store_id"], ["store.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("store_id"),
    )


def downgrade() -> None:
    op.drop_table("store_order_field_config")
