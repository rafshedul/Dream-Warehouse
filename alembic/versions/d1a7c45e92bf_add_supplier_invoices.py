"""Add supplier invoice documents and purchase links.

Revision ID: d1a7c45e92bf
Revises: c23d9b8a1f40
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d1a7c45e92bf"
down_revision: Union[str, Sequence[str], None] = "c23d9b8a1f40"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "supplier_invoices",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("supplier_id", sa.Integer(), nullable=False),
        sa.Column("purchase_order_id", sa.Integer(), nullable=False),
        sa.Column("invoice_number", sa.String(length=100), nullable=True),
        sa.Column("invoice_date", sa.DateTime(), nullable=False),
        sa.Column("amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=100), nullable=False),
        sa.Column("file_data", sa.LargeBinary(), nullable=False),
        sa.Column("uploaded_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["purchase_order_id"], ["purchase_orders.id"]),
        sa.ForeignKeyConstraint(["supplier_id"], ["suppliers.id"]),
        sa.ForeignKeyConstraint(["uploaded_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("purchase_order_id"),
    )
    op.create_index(op.f("ix_supplier_invoices_id"), "supplier_invoices", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_supplier_invoices_id"), table_name="supplier_invoices")
    op.drop_table("supplier_invoices")
