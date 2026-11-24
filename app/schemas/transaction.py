
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class TransactionCreate(BaseModel):
    contact_id: int = Field(gt=0)
    sales_order_id: int = Field(gt=0)
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    date: datetime | None = None
    status: str = Field(default="pending", min_length=1, max_length=50)


class TransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    contact_id: int
    sales_order_id: int
    amount: Decimal
    date: datetime
    status: str
    created_by: int | None = None


class TransactionCreateResponse(TransactionResponse):
    invoice_id: int | None = None
    invoice_number: str | None = None
    invoice_created: bool
