from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class StorefrontItemCreate(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(gt=0, le=5000)


class CartValidateRequest(BaseModel):
    items: list[StorefrontItemCreate] = Field(min_length=1, max_length=100)


class StorefrontCheckoutCreate(BaseModel):
    items: list[StorefrontItemCreate] = Field(min_length=1, max_length=100)
    shipping_address: str = Field(min_length=8, max_length=1000)
    shipping_phone: str = Field(min_length=6, max_length=50)
    shipping_email: EmailStr | None = None  # ignored: the account email is always used
    delivery_note: str | None = Field(default=None, max_length=1000)
    payment_method: Literal["sslcommerz", "cod"] = "sslcommerz"


class StorefrontCheckoutResponse(BaseModel):
    sales_order_id: int
    order_number: str
    amount: float
    payment_method: str
    payment_status: str
    order_status: str
    payment_url: str | None = None


class StorefrontOrderItemResponse(BaseModel):
    id: int
    product_id: int
    product_name: str
    sku: str
    category_name: str
    quantity: int
    unit_price: float
    total_price: float


class StorefrontOrderResponse(BaseModel):
    id: int
    order_number: str
    created_at: str
    total_amount: float
    shipping_fee: float
    payment_method: str | None
    payment_status: str
    order_status: str
    shipping_address: str | None
    shipping_phone: str | None
    tracking_number: str | None
    invoice_number: str | None = None
    items: list[StorefrontOrderItemResponse]
