
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class SalesOrderItemCreate(BaseModel):
    product_id: int = Field(gt=0)
    sales_order_id: int = Field(gt=0)
    quantity: int = Field(gt=0)
    unit_price: Decimal = Field(ge=0, max_digits=12, decimal_places=2)


class SalesOrderItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    sales_order_id: int
    quantity: int
    unit_price: Decimal
    total_price: Decimal
