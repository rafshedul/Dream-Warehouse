
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.invoice import Invoice
from app.models.sales_order import SalesOrder
from app.models.transaction import Transaction
from app.models.user import User

from app.schemas.invoice import InvoiceCreate, InvoiceResponse
from app.core.dependencies import require_roles
from app.core.roles import UserRole

router = APIRouter(
    prefix="/invoices",
    tags=["Invoices"],
)


# Create: Admin only
@router.post("/", response_model=InvoiceResponse, status_code=201)
def create_invoice(
    data: InvoiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
):
    sales_order = db.get(SalesOrder, data.sales_order_id)

    if sales_order is None:
        raise HTTPException(
            status_code=404,
            detail="Sales order not found",
        )

    transaction = db.get(Transaction, data.transaction_id)

    if transaction is None:
        raise HTTPException(
            status_code=404,
            detail="Transaction not found",
        )

    if transaction.sales_order_id != sales_order.id:
        raise HTTPException(
            status_code=400,
            detail="Transaction does not belong to this sales order.",
        )

    existing_invoice = (
        db.query(Invoice)
        .filter(Invoice.sales_order_id == sales_order.id)
        .first()
    )

    if existing_invoice:
        raise HTTPException(
            status_code=409,
            detail="Invoice already exists for this sales order.",
        )

    invoice = Invoice(
        user_id=current_user.id,
        sales_order_id=data.sales_order_id,
        transaction_id=data.transaction_id,
    )

    db.add(invoice)

    try:
        db.commit()
        db.refresh(invoice)
        return invoice

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Unable to create invoice due to database constraint.",
        )


# View All: Admin + Manager
@router.get("/", response_model=list[InvoiceResponse])
def get_invoices(
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles([UserRole.ADMIN, UserRole.MANAGER])
    ),
):
    return db.query(Invoice).order_by(Invoice.id.desc()).all()


# View One: Admin + Manager
@router.get("/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles([UserRole.ADMIN, UserRole.MANAGER])
    ),
):
    invoice = db.get(Invoice, invoice_id)

    if invoice is None:
        raise HTTPException(
            status_code=404,
            detail="Invoice not found",
        )

    return invoice


# Update: Admin only
@router.put("/{invoice_id}", response_model=InvoiceResponse)
def update_invoice(
    invoice_id: int,
    data: InvoiceCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles([UserRole.ADMIN])),
):
    invoice = db.get(Invoice, invoice_id)

    if invoice is None:
        raise HTTPException(
            status_code=404,
            detail="Invoice not found",
        )

    sales_order = db.get(SalesOrder, data.sales_order_id)
    transaction = db.get(Transaction, data.transaction_id)

    if sales_order is None or transaction is None:
        raise HTTPException(
            status_code=404,
            detail="Sales order or transaction not found",
        )

    if transaction.sales_order_id != sales_order.id:
        raise HTTPException(
            status_code=400,
            detail="Transaction does not belong to this sales order.",
        )

    duplicate = (
        db.query(Invoice)
        .filter(
            Invoice.sales_order_id == sales_order.id,
            Invoice.id != invoice_id,
        )
        .first()
    )

    if duplicate:
        raise HTTPException(
            status_code=409,
            detail="Invoice already exists for this sales order.",
        )

    invoice.sales_order_id = data.sales_order_id
    invoice.transaction_id = data.transaction_id

    try:
        db.commit()
        db.refresh(invoice)
        return invoice

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Unable to update invoice.",
        )


# Delete: Admin only
@router.delete("/{invoice_id}", status_code=204)
def delete_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles([UserRole.ADMIN])),
):
    invoice = db.get(Invoice, invoice_id)

    if invoice is None:
        raise HTTPException(
            status_code=404,
            detail="Invoice not found",
        )

    db.delete(invoice)
    db.commit()

    return Response(status_code=204)
