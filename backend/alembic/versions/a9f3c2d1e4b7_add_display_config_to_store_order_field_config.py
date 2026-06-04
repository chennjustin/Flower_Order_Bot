"""add display_config JSON to store_order_field_config

Revision ID: a9f3c2d1e4b7
Revises: e2f1a4b5c6d7
Create Date: 2026-06-01 12:00:00.000000

Backfill shape:
  {"visible_fields": [...], "field_order": [...catalog keys...]}
"""

from __future__ import annotations

import json

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "a9f3c2d1e4b7"
down_revision = "e2f1a4b5c6d7"
branch_labels = None
depends_on = None

TABLE = "store_order_field_config"
# Frozen at migration authoring time; do not import runtime catalog (deterministic upgrade).
DEFAULT_FIELD_ORDER: list[str] = [
    "id",
    "customer_name",
    "customer_phone",
    "item",
    "order_status",
    "send_datetime",
    "total_amount",
    "quantity",
    "note",
    "shipment_method",
    "delivery_address",
    "pay_way",
    "pay_status",
    "order_date",
]


def _empty_display_config() -> dict:
    return {"visible_fields": [], "field_order": list(DEFAULT_FIELD_ORDER)}


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if TABLE not in insp.get_table_names(schema="public"):
        return

    columns = {c["name"] for c in insp.get_columns(TABLE, schema="public")}
    if "display_config" not in columns:
        op.add_column(TABLE, sa.Column("display_config", sa.JSON(), nullable=True))

    conn = op.get_bind()
    rows = conn.execute(
        sa.text(f"SELECT id, visible_fields, display_config FROM {TABLE}")
    ).fetchall()

    for row in rows:
        row_id = row[0]
        visible_fields = row[1]
        existing_display = row[2]

        if existing_display is not None and isinstance(existing_display, dict):
            if (
                isinstance(existing_display.get("visible_fields"), list)
                and isinstance(existing_display.get("field_order"), list)
            ):
                continue

        if not isinstance(visible_fields, list):
            visible_fields = []

        display_config = {
            "visible_fields": visible_fields,
            "field_order": list(DEFAULT_FIELD_ORDER),
        }
        # psycopg2 cannot bind raw dict; serialize to JSON text for PostgreSQL.
        conn.execute(
            sa.text(
                f"UPDATE {TABLE} SET display_config = CAST(:display_config AS JSON) "
                "WHERE id = :id"
            ),
            {"display_config": json.dumps(display_config), "id": row_id},
        )

    # All rows populated; enforce NOT NULL for new code paths.
    op.alter_column(TABLE, "display_config", nullable=False)


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if TABLE not in insp.get_table_names(schema="public"):
        return
    columns = {c["name"] for c in insp.get_columns(TABLE, schema="public")}
    if "display_config" in columns:
        op.drop_column(TABLE, "display_config")
