
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class SalesOrderCreate(BaseModel):
    contact_id: int = Field(gt=0)
    total_amount: float = Field(ge=0)


class SalesOrderLineCreate(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(gt=0)
    unit_price: Decimal = Field(ge=0, max_digits=12, decimal_places=2)


class SalesOrderWithItemsCreate(BaseModel):
    contact_id: int = Field(gt=0)
    items: list[SalesOrderLineCreate] = Field(min_length=1)


class SalesOrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    contact_id: int
    created_by: int | None = None
    total_amount: float
    created_at: datetime
    customer_user_id: int | None = None
    fulfillment_warehouse_id: int | None = None
    shipping_fee: float = 0
    order_status: str = "processing"
    payment_status: str = "untracked"
    payment_method: str | None = None
    shipping_address: str | None = None
    shipping_phone: str | None = None
    shipping_email: str | None = None


# ---- Staff order management (search + detail) ----

class SalesOrderListRow(BaseModel):
    id: int
    order_number: str
    source: str  # "online" | "internal"
    created_at: datetime
    customer_name: str | None = None
    customer_phone: str | None = None
    total_amount: float
    shipping_fee: float = 0
    payment_method: str | None = None
    payment_status: str
    order_status: str
    item_count: int = 0


class SalesOrderSearchResponse(BaseModel):
    orders: list[SalesOrderListRow]
    total: int
    page: int
    limit: int
    total_pages: int
    counts: dict[str, int]


class SalesOrderDetailItem(BaseModel):
    id: int
    product_id: int
    product_name: str
    sku: str
    category_name: str | None = None
    quantity: int
    unit_price: float
    total_price: float


class SalesOrderDetailShipment(BaseModel):
    id: int
    tracking_number: str
    status: str
    date: datetime
    warehouse_name: str | None = None


class SalesOrderDetailResponse(BaseModel):
    id: int
    order_number: str
    source: str
    created_at: datetime
    customer_name: str | None = None
    customer_phone: str | None = None
    customer_email: str | None = None
    shipping_address: str | None = None
    shipping_phone: str | None = None
    delivery_note: str | None = None
    total_amount: float
    shipping_fee: float = 0
    payment_method: str | None = None
    payment_status: str
    order_status: str
    fulfillment_warehouse_name: str | None = None
    items: list[SalesOrderDetailItem]
    shipment: SalesOrderDetailShipment | None = None
    invoice_number: str | None = None
