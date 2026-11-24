"""Add stock adjustment requests table.

Revision ID: c23d9b8a1f40
Revises: e8b5c46cc221
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "c23d9b8a1f40"
down_revision: Union[str, Sequence[str], None] = "e8b5c46cc221"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "stock_adjustment_requests",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("warehouse_id", sa.Integer(), nullable=False),
        sa.Column("current_quantity", sa.Integer(), nullable=False),
        sa.Column("counted_quantity", sa.Integer(), nullable=False),
        sa.Column("difference", sa.Integer(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("requested_by", sa.Integer(), nullable=False),
        sa.Column("reviewed_by", sa.Integer(), nullable=True),
        sa.Column("review_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.CheckConstraint(
            "counted_quantity >= 0",
            name="ck_adjustment_counted_quantity_non_negative",
        ),
        sa.CheckConstraint(
            "current_quantity >= 0",
            name="ck_adjustment_current_quantity_non_negative",
        ),
        sa.CheckConstraint(
            "difference != 0",
            name="ck_adjustment_difference_non_zero",
        ),
        sa.CheckConstraint(
            "difference = counted_quantity - current_quantity",
            name="ck_adjustment_difference_correct",
        ),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"]),
        sa.ForeignKeyConstraint(["requested_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["reviewed_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["warehouse_id"], ["warehouses.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_stock_adjustment_requests_id"),
        "stock_adjustment_requests",
        ["id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_stock_adjustment_requests_id"),
        table_name="stock_adjustment_requests",
    )
    op.drop_table("stock_adjustment_requests")
