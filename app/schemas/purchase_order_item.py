
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class PurchaseOrderItemLineCreate(BaseModel):
    """An item line submitted together with its purchase order."""

    product_id: int
    quantity: int = Field(gt=0)
    unit_price: Decimal = Field(ge=0, max_digits=12, decimal_places=2)


class PurchaseOrderWithItemsCreate(BaseModel):
    supplier_id: int
    date: datetime | None = None
    items: list[PurchaseOrderItemLineCreate] = Field(min_length=1)


class PurchaseOrderWithInvoiceCreate(PurchaseOrderWithItemsCreate):
    invoice_number: str | None = Field(default=None, max_length=100)
    invoice_date: datetime
    invoice_amount: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=12,
        decimal_places=2,
    )


class PurchaseOrderItemCreate(BaseModel):
    purchase_order_id: int
    product_id: int
    quantity: int = Field(gt=0)
    unit_price: Decimal = Field(
        ge=0,
        max_digits=12,
        decimal_places=2,
    )
class PurchaseOrderItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    purchase_order_id: int
    product_id: int
    quantity: int
    unit_price: Decimal
    created_at: datetime
