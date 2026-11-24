
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class StockAdjustmentRequestCreate(BaseModel):
    product_id: int = Field(gt=0)
    warehouse_id: int = Field(gt=0)
    counted_quantity: int = Field(ge=0)
    reason: str = Field(min_length=5, max_length=1000)


class StockAdjustmentReview(BaseModel):
    review_note: str | None = Field(
        default=None,
        max_length=1000,
    )


class StockAdjustmentRequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    warehouse_id: int
    current_quantity: int
    counted_quantity: int
    difference: int
    reason: str
    status: str
    requested_by: int
    reviewed_by: int | None
    review_note: str | None
    created_at: datetime
    reviewed_at: datetime | None


class StockAdjustmentRequestListResponse(BaseModel):
    total_requests: int
    total_pages: int
    current_page: int
    limit: int
    requests: list[StockAdjustmentRequestResponse]
