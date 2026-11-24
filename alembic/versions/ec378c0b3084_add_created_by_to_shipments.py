
"""add created_by to shipments"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "ec378c0b3084"
down_revision: Union[str, Sequence[str], None] = "3e9c37d05518"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "shipments",
        sa.Column("created_by", sa.Integer(), nullable=True),
    )

    op.create_foreign_key(
        "fk_shipments_created_by_users",
        "shipments",
        "users",
        ["created_by"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_shipments_created_by_users",
        "shipments",
        type_="foreignkey",
    )

    op.drop_column("shipments", "created_by")
