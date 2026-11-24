from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from starlette.responses import Response

from app.core.dependencies import require_roles
from app.core.roles import UserRole
from app.database import get_db
from app.models.purchase import PurchaseOrder
from app.models.purchase_order_item import PurchaseOrderItem
from app.models.supplier_invoice import SupplierInvoice
from app.models.user import User
from app.schemas.purchase_order_item import PurchaseOrderWithInvoiceCreate
from app.schemas.supplier_invoice import SupplierInvoiceResponse


router = APIRouter(prefix="/supplier-invoices", tags=["Supplier Invoices"])
PURCHASE_ROLES = [UserRole.ADMIN, UserRole.MANAGER]
MAX_INVOICE_SIZE = 15 * 1024 * 1024
ALLOWED_CONTENT_TYPES = {"application/pdf", "image/jpeg", "image/png", "image/webp"}


def validate_file_signature(content_type: str, data: bytes) -> bool:
    if content_type == "application/pdf":
        return data.startswith(b"%PDF-")
    if content_type == "image/jpeg":
        return data.startswith(b"\xff\xd8\xff")
    if content_type == "image/png":
        return data.startswith(b"\x89PNG\r\n\x1a\n")
    if content_type == "image/webp":
        return len(data) >= 12 and data.startswith(b"RIFF") and data[8:12] == b"WEBP"
    return False


@router.post("/with-purchase-order", response_model=SupplierInvoiceResponse, status_code=201)
async def create_supplier_invoice_with_purchase_order(
    purchase_data: str = Form(...),
    invoice_file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(PURCHASE_ROLES)),
):
    try:
        data = PurchaseOrderWithInvoiceCreate.model_validate_json(purchase_data)
    except Exception as exc:
        raise HTTPException(status_code=422, detail="Invalid purchase and invoice details.") from exc

    content_type = (invoice_file.content_type or "").split(";", 1)[0].lower()
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=415, detail="Upload a PDF, JPG, PNG, or WEBP invoice.")

    file_data = await invoice_file.read(MAX_INVOICE_SIZE + 1)
    if not file_data:
        raise HTTPException(status_code=400, detail="The invoice file is empty.")
    if len(file_data) > MAX_INVOICE_SIZE:
        raise HTTPException(status_code=413, detail="Invoice files must be 15 MB or smaller.")
    if not validate_file_signature(content_type, file_data):
        raise HTTPException(status_code=415, detail="The file content does not match its PDF or image type.")

    raw_name = (invoice_file.filename or "supplier-invoice").replace("\\", "/")
    file_name = Path(raw_name).name.strip()[:255] or "supplier-invoice"
    invoice_date = data.invoice_date
    order_total = sum((line.unit_price * line.quantity for line in data.items), start=0)
    purchase_order = PurchaseOrder(
        supplier_id=data.supplier_id,
        date=data.date or invoice_date,
        total_amount=order_total,
        created_by=current_user.id,
    )
    db.add(purchase_order)

    try:
        db.flush()
        for line in data.items:
            db.add(
                PurchaseOrderItem(
                    purchase_order_id=purchase_order.id,
                    product_id=line.product_id,
                    quantity=line.quantity,
                    unit_price=line.unit_price,
                )
            )

        invoice = SupplierInvoice(
            supplier_id=data.supplier_id,
            purchase_order_id=purchase_order.id,
            invoice_number=data.invoice_number,
            invoice_date=invoice_date,
            amount=data.invoice_amount if data.invoice_amount is not None else order_total,
            file_name=file_name,
            content_type=content_type,
            file_data=file_data,
            uploaded_by=current_user.id,
        )
        db.add(invoice)
        db.commit()
        db.refresh(invoice)
        return invoice
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Invalid supplier or product, or a purchase order/invoice database constraint was violated.",
        ) from exc


@router.get("/", response_model=list[SupplierInvoiceResponse])
def list_supplier_invoices(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(PURCHASE_ROLES)),
):
    return db.query(SupplierInvoice).order_by(SupplierInvoice.invoice_date.desc(), SupplierInvoice.id.desc()).all()


@router.get("/{invoice_id}/file")
def get_supplier_invoice_file(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(PURCHASE_ROLES)),
):
    invoice = db.get(SupplierInvoice, invoice_id)
    if invoice is None:
        raise HTTPException(status_code=404, detail="Supplier invoice not found.")

    return Response(
        content=invoice.file_data,
        media_type=invoice.content_type,
        headers={"Content-Disposition": f"inline; filename*=UTF-8''{quote(invoice.file_name)}"},
    )
