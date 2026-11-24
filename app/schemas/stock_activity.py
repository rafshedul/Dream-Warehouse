
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class StockActivityCreate(BaseModel):
    product_id: int = Field(gt=0)
    warehouse_id: int = Field(gt=0)
    quantity: int = Field(gt=0)
    date: datetime | None = None

    # Direct Stock Movement only
    # Adjustment will happen through Approval API
    movement_type: Literal["IN", "OUT"]


class StockActivityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    warehouse_id: int
    quantity: int
    date: datetime

    movement_type: Literal["IN", "OUT", "ADJUSTMENT"]

    created_by: int | None = None
