
"""add created_by to transactions"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "4eec32e7cce7"
down_revision: Union[str, Sequence[str], None] = "ec378c0b3084"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "transactions",
        sa.Column("created_by", sa.Integer(), nullable=True),
    )

    op.create_foreign_key(
        "fk_transactions_created_by_users",
        "transactions",
        "users",
        ["created_by"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_transactions_created_by_users",
        "transactions",
        type_="foreignkey",
    )

    op.drop_column("transactions", "created_by")
