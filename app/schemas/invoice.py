
from pydantic import BaseModel, ConfigDict, Field


class InvoiceCreate(BaseModel):
    sales_order_id: int = Field(gt=0)
    transaction_id: int = Field(gt=0)


class InvoiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    sales_order_id: int
    transaction_id: int
