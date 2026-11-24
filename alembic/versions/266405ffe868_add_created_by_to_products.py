
"""add created_by to products

Revision ID: 266405ffe868
Revises: 78fd22b8c81a
Create Date: 2026-11-01 17:43:41.322709

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '266405ffe868'
down_revision: Union[str, Sequence[str], None] = '78fd22b8c81a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:

    op.add_column(
        'products',
        sa.Column('created_by', sa.Integer(), nullable=True)
    )

    op.create_foreign_key(
        'fk_products_created_by_users',
        'products',
        'users',
        ['created_by'],
        ['id']
    )


def downgrade() -> None:

    op.drop_constraint(
        'fk_products_created_by_users',
        'products',
        type_='foreignkey'
    )

    op.drop_column('products', 'created_by')
