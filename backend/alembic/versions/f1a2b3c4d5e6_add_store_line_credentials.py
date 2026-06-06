"""add store LINE channel credentials

Revision ID: f1a2b3c4d5e6
Revises: a9f3c2d1e4b7
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
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "store" not in insp.get_table_names(schema="public"):
        return

    cols = {c["name"] for c in insp.get_columns("store", schema="public")}
    if "line_channel_access_token" not in cols:
        op.add_column(
            "store",
            sa.Column("line_channel_access_token", sa.String(), nullable=True),
        )
    if "line_channel_secret" not in cols:
        op.add_column(
            "store",
            sa.Column("line_channel_secret", sa.String(), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "store" not in insp.get_table_names(schema="public"):
        return

    cols = {c["name"] for c in insp.get_columns("store", schema="public")}
    if "line_channel_secret" in cols:
        op.drop_column("store", "line_channel_secret")
    if "line_channel_access_token" in cols:
        op.drop_column("store", "line_channel_access_token")
