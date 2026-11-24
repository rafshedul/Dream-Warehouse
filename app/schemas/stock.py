
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class StockCreate(BaseModel):
    warehouse_id: int = Field(gt=0)
    product_id: int = Field(gt=0)


class StockResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    warehouse_id: int
    product_id: int
    quantity: int
    updated_at: datetime
