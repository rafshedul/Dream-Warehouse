
"""add created_by to sales orders

Revision ID: 5a23fb2ee409
Revises: 266405ffe868
Create Date: 2026-11-01 18:04:56.268189

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '5a23fb2ee409'
down_revision: Union[str, Sequence[str], None] = '266405ffe868'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:

    op.add_column(
        'sales_orders',
        sa.Column('created_by', sa.Integer(), nullable=True)
    )

    op.create_foreign_key(
        'fk_sales_orders_created_by_users',
        'sales_orders',
        'users',
        ['created_by'],
        ['id']
    )


def downgrade() -> None:

    op.drop_constraint(
        'fk_sales_orders_created_by_users',
        'sales_orders',
        type_='foreignkey'
    )

    op.drop_column('sales_orders', 'created_by')
