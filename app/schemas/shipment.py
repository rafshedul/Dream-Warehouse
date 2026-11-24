
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ShipmentCreate(BaseModel):
    sales_order_id: int = Field(gt=0)
    warehouse_id: int = Field(gt=0)
    contact_id: int = Field(gt=0)
    tracking_number: str = Field(min_length=1, max_length=100)
    date: datetime | None = None
    status: str = Field(default="pending", min_length=1, max_length=50)


class ShipmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sales_order_id: int
    warehouse_id: int
    contact_id: int
    tracking_number: str
    date: datetime
    status: str
    created_by: int | None = None
