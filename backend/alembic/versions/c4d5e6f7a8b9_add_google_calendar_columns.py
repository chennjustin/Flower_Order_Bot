"""add google calendar columns to store and order

Revision ID: c4d5e6f7a8b9
Revises: b3c4d5e6f7a8
Create Date: 2026-06-06

Store gains the owner's encrypted Google refresh token + connected email + target
calendar id; order gains the synced calendar event id. All nullable, non-destructive.
Idempotent: safe on Supabase that already has these columns.
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "c4d5e6f7a8b9"
down_revision = "b3c4d5e6f7a8"
branch_labels = None
depends_on = None

STORE_COLUMNS = {
    "google_calendar_refresh_token": sa.String(),
    "google_calendar_email": sa.String(),
    "google_calendar_id": sa.String(),
}
ORDER_COLUMNS = {
    "google_calendar_event_id": sa.String(),
}


def _existing_columns(insp: sa.Inspector, table: str) -> set[str]:
    if table not in insp.get_table_names(schema="public"):
        return set()
    return {c["name"] for c in insp.get_columns(table, schema="public")}


def _add_missing(insp: sa.Inspector, table: str, columns: dict[str, sa.types.TypeEngine]) -> None:
    if table not in insp.get_table_names(schema="public"):
        return
    existing = _existing_columns(insp, table)
    for name, type_ in columns.items():
        if name not in existing:
            op.add_column(table, sa.Column(name, type_, nullable=True))


def _drop_present(insp: sa.Inspector, table: str, columns: dict[str, sa.types.TypeEngine]) -> None:
    if table not in insp.get_table_names(schema="public"):
        return
    existing = _existing_columns(insp, table)
    for name in columns:
        if name in existing:
            op.drop_column(table, name)


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    _add_missing(insp, "store", STORE_COLUMNS)
    _add_missing(insp, "order", ORDER_COLUMNS)


def downgrade() -> None:
    insp = sa.inspect(op.get_bind())
    _drop_present(insp, "order", ORDER_COLUMNS)
    _drop_present(insp, "store", STORE_COLUMNS)
