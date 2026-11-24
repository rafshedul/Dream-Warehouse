
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class PurchaseCreate(BaseModel):
    supplier_id: int
    date: datetime | None = None
    total_amount: Decimal = Field(
        ge=0,
        max_digits=12,
        decimal_places=2,
    )


class PurchaseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    supplier_id: int
    created_by: int | None = None
    created_at: datetime
    date: datetime
    total_amount: Decimal
