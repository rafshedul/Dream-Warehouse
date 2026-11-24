"""Add customer checkout and payment tracking fields.

Revision ID: e3f4a6b812cd
Revises: d1a7c45e92bf
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e3f4a6b812cd"
down_revision: Union[str, Sequence[str], None] = "d1a7c45e92bf"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("sales_orders", sa.Column("customer_user_id", sa.Integer(), nullable=True))
    op.add_column("sales_orders", sa.Column("fulfillment_warehouse_id", sa.Integer(), nullable=True))
    op.add_column("sales_orders", sa.Column("shipping_fee", sa.Numeric(12, 2), server_default="0", nullable=False))
    op.add_column("sales_orders", sa.Column("order_status", sa.String(30), server_default="processing", nullable=False))
    op.add_column("sales_orders", sa.Column("payment_status", sa.String(30), server_default="untracked", nullable=False))
    op.add_column("sales_orders", sa.Column("payment_method", sa.String(30), nullable=True))
    op.add_column("sales_orders", sa.Column("shipping_address", sa.Text(), nullable=True))
    op.add_column("sales_orders", sa.Column("shipping_phone", sa.String(50), nullable=True))
    op.add_column("sales_orders", sa.Column("shipping_email", sa.String(255), nullable=True))
    op.add_column("sales_orders", sa.Column("delivery_note", sa.Text(), nullable=True))
    op.add_column("sales_orders", sa.Column("stock_released", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.create_foreign_key("fk_sales_orders_customer_user", "sales_orders", "users", ["customer_user_id"], ["id"])
    op.create_foreign_key("fk_sales_orders_fulfillment_warehouse", "sales_orders", "warehouses", ["fulfillment_warehouse_id"], ["id"])
    op.create_index("ix_sales_orders_customer_user_id", "sales_orders", ["customer_user_id"])

    op.add_column("transactions", sa.Column("gateway_tran_id", sa.String(30), nullable=True))
    op.add_column("transactions", sa.Column("validation_id", sa.String(80), nullable=True))
    op.create_unique_constraint("uq_transactions_gateway_tran_id", "transactions", ["gateway_tran_id"])


def downgrade() -> None:
    op.drop_constraint("uq_transactions_gateway_tran_id", "transactions", type_="unique")
    op.drop_column("transactions", "validation_id")
    op.drop_column("transactions", "gateway_tran_id")
    op.drop_index("ix_sales_orders_customer_user_id", table_name="sales_orders")
    op.drop_constraint("fk_sales_orders_fulfillment_warehouse", "sales_orders", type_="foreignkey")
    op.drop_constraint("fk_sales_orders_customer_user", "sales_orders", type_="foreignkey")
    for column in (
        "stock_released", "delivery_note", "shipping_email", "shipping_phone",
        "shipping_address", "payment_method", "payment_status", "order_status",
        "shipping_fee", "fulfillment_warehouse_id", "customer_user_id",
    ):
        op.drop_column("sales_orders", column)
