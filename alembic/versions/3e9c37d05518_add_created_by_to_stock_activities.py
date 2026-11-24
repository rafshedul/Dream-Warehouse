
"""add created_by to stock activities

Revision ID: 3e9c37d05518
Revises: 10ce7ea89b71
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "3e9c37d05518"
down_revision: Union[str, Sequence[str], None] = "10ce7ea89b71"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "stock_activities",
        sa.Column("created_by", sa.Integer(), nullable=True),
    )

    op.create_foreign_key(
        "fk_stock_activities_created_by_users",
        "stock_activities",
        "users",
        ["created_by"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_stock_activities_created_by_users",
        "stock_activities",
        type_="foreignkey",
    )

    op.drop_column("stock_activities", "created_by")
