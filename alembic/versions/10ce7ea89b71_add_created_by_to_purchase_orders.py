
"""add created_by to purchase orders

Revision ID: 10ce7ea89b71
Revises: 5a23fb2ee409
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "10ce7ea89b71"
down_revision: Union[str, Sequence[str], None] = "5a23fb2ee409"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "purchase_orders",
        sa.Column("created_by", sa.Integer(), nullable=True),
    )

    op.create_foreign_key(
        "fk_purchase_orders_created_by_users",
        "purchase_orders",
        "users",
        ["created_by"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_purchase_orders_created_by_users",
        "purchase_orders",
        type_="foreignkey",
    )

    op.drop_column(
        "purchase_orders",
        "created_by",
    )
