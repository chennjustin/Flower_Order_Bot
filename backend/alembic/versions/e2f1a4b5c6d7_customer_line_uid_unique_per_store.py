"""customer line_uid unique per store

Revision ID: e2f1a4b5c6d7
Revises: d4e5f6a7b8c9
Create Date: 2026-05-29 00:58:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "e2f1a4b5c6d7"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    unique_constraints = insp.get_unique_constraints("customer", schema="public")
    for uc in unique_constraints:
        cols = uc.get("column_names") or []
        if cols == ["line_uid"] and uc.get("name"):
            op.drop_constraint(uc["name"], "customer", type_="unique")

    names = {uc.get("name") for uc in unique_constraints}
    if "uq_customer_store_line_uid" not in names:
        op.create_unique_constraint(
            "uq_customer_store_line_uid",
            "customer",
            ["store_id", "line_uid"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    unique_constraints = insp.get_unique_constraints("customer", schema="public")
    names = {uc.get("name") for uc in unique_constraints}

    if "uq_customer_store_line_uid" in names:
        op.drop_constraint("uq_customer_store_line_uid", "customer", type_="unique")

    if not any((uc.get("column_names") or []) == ["line_uid"] for uc in unique_constraints):
        op.create_unique_constraint("uq_customer_line_uid", "customer", ["line_uid"])
