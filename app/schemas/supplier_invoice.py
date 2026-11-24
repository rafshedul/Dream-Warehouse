from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class SupplierInvoiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    supplier_id: int
    purchase_order_id: int
    invoice_number: str | None
    invoice_date: datetime
    amount: Decimal
    file_name: str
    content_type: str
    uploaded_by: int | None
    created_at: datetime
