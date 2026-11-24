
"""remove legacy quantity from products

Revision ID: e8b5c46cc221
Revises: 03e3b9e97721
Create Date: 2026-11-10 16:38:20.520301

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e8b5c46cc221'
down_revision: Union[str, Sequence[str], None] = '03e3b9e97721'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Remove legacy quantity column from products."""

    op.drop_column(
        'products',
        'quantity'
    )


def downgrade() -> None:
    """Restore legacy quantity column."""

    op.add_column(
        'products',
        sa.Column(
            'quantity',
            sa.Integer(),
            nullable=False,
            server_default=sa.text('0')
        )
    )

    op.alter_column(
        'products',
        'quantity',
        server_default=None
    )
