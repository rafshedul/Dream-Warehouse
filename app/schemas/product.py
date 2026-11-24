
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class ProductCreate(BaseModel):
    category_id: int = Field(gt=0)

    sku: str = Field(
        min_length=1,
        max_length=100
    )

    name: str = Field(
        min_length=1,
        max_length=150
    )

    description: str | None = None

    unit_price: Decimal = Field(
        gt=0,
        max_digits=10,
        decimal_places=2
    )

    reorder_level: int = Field(
        default=10,
        ge=0
    )


class ProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    category_id: int
    created_by: int | None = None

    sku: str
    name: str
    description: str | None

    unit_price: Decimal
    reorder_level: int

    created_at: datetime | None = None
    updated_at: datetime | None = None


# ==========================================
# Product Stock Detail Schemas
# ==========================================

class WarehouseStockResponse(BaseModel):
    warehouse_id: int
    warehouse_name: str
    quantity: int


class ProductDetailResponse(ProductResponse):
    total_stock: int
    stock_status: str
    warehouse_stocks: list[WarehouseStockResponse]


# ==========================================
# Product Pagination Response
# ==========================================

class ProductPaginationResponse(BaseModel):
    total_products: int
    total_pages: int

    current_page: int
    limit: int

    products: list[ProductResponse]
