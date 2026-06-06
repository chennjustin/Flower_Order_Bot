"""add store owner_email and nullable owner_auth_user_id

Revision ID: b3c4d5e6f7a8
Revises: f1a2b3c4d5e6
Create Date: 2026-06-06

Aligns store table with Store model and auth.py first-login binding flow.
Idempotent: safe on Supabase that already has these columns/indexes.
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "b3c4d5e6f7a8"
down_revision = "f1a2b3c4d5e6"
branch_labels = None
depends_on = None

TABLE = "store"
OWNER_EMAIL_UQ = "uq_store_owner_email"
OWNER_AUTH_UQ_INDEX = "uq_store_owner_auth_user_id"


def _constraint_names(insp: sa.Inspector) -> set[str]:
    if TABLE not in insp.get_table_names(schema="public"):
        return set()
    return {c["name"] for c in insp.get_unique_constraints(TABLE, schema="public")}


def _index_names(insp: sa.Inspector) -> set[str]:
    if TABLE not in insp.get_table_names(schema="public"):
        return set()
    return {ix["name"] for ix in insp.get_indexes(TABLE, schema="public")}


def _column_meta(insp: sa.Inspector, name: str) -> dict | None:
    if TABLE not in insp.get_table_names(schema="public"):
        return None
    for col in insp.get_columns(TABLE, schema="public"):
        if col["name"] == name:
            return col
    return None


def _ensure_owner_email_not_null(bind: sa.Connection, insp: sa.Inspector) -> None:
    owner_email_col = _column_meta(insp, "owner_email")
    if owner_email_col is None:
        return
    if not owner_email_col.get("nullable"):
        return
    bind.execute(
        sa.text(
            f"UPDATE {TABLE} SET owner_email = 'unprovisioned-' || id::text || '@local' "
            "WHERE owner_email IS NULL"
        )
    )
    op.alter_column(TABLE, "owner_email", nullable=False)


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if TABLE not in insp.get_table_names(schema="public"):
        return

    cols = {c["name"] for c in insp.get_columns(TABLE, schema="public")}

    if "owner_email" not in cols:
        op.add_column(TABLE, sa.Column("owner_email", sa.String(), nullable=True))
        insp = sa.inspect(bind)

    _ensure_owner_email_not_null(bind, insp)

    insp = sa.inspect(bind)
    if OWNER_EMAIL_UQ not in _constraint_names(insp):
        op.create_unique_constraint(OWNER_EMAIL_UQ, TABLE, ["owner_email"])

    owner_auth_col = _column_meta(insp, "owner_auth_user_id")
    if owner_auth_col is not None and not owner_auth_col.get("nullable"):
        op.alter_column(TABLE, "owner_auth_user_id", nullable=True)

    insp = sa.inspect(bind)
    if OWNER_AUTH_UQ_INDEX not in _index_names(insp):
        op.execute(
            sa.text(
                f"CREATE UNIQUE INDEX {OWNER_AUTH_UQ_INDEX} ON {TABLE} (owner_auth_user_id) "
                "WHERE owner_auth_user_id IS NOT NULL"
            )
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if TABLE not in insp.get_table_names(schema="public"):
        return

    index_names = _index_names(insp)
    if OWNER_AUTH_UQ_INDEX in index_names:
        op.drop_index(OWNER_AUTH_UQ_INDEX, table_name=TABLE)

    constraint_names = _constraint_names(insp)
    if OWNER_EMAIL_UQ in constraint_names:
        op.drop_constraint(OWNER_EMAIL_UQ, TABLE, type_="unique")

    cols = {c["name"] for c in insp.get_columns(TABLE, schema="public")}
    if "owner_email" in cols:
        op.drop_column(TABLE, "owner_email")

    owner_auth_col = _column_meta(insp, "owner_auth_user_id")
    if owner_auth_col is not None and owner_auth_col.get("nullable"):
        bind.execute(
            sa.text(f"UPDATE {TABLE} SET owner_auth_user_id = gen_random_uuid() WHERE owner_auth_user_id IS NULL")
        )
        op.alter_column(TABLE, "owner_auth_user_id", nullable=False)
