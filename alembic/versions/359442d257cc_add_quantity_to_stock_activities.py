
"""add quantity to stock activities

Revision ID: 359442d257cc
Revises: 4eec32e7cce7
Create Date: 2026-11-03 15:47:33.881873

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '359442d257cc'
down_revision: Union[str, Sequence[str], None] = '4eec32e7cce7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    op.add_column(
        "stock_activities",
        sa.Column(
            "quantity",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )

    op.alter_column(
        "stock_activities",
        "quantity",
        server_default=None,
    )


def downgrade() -> None:
    """Downgrade schema."""

    op.drop_column(
        "stock_activities",
        "quantity",
    )
