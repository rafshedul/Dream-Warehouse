
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.invoice import Invoice
from app.models.sales_order import SalesOrder
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.transaction import (
    TransactionCreate,
    TransactionCreateResponse,
    TransactionResponse,
)
from app.core.dependencies import require_roles
from app.core.roles import UserRole

router = APIRouter(
    prefix="/transactions",
    tags=["Transactions"],
)


# Create: Admin only
@router.post("/", response_model=TransactionCreateResponse, status_code=201)
def create_transaction(
    data: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
):
    sales_order = db.get(SalesOrder, data.sales_order_id)
    if sales_order is None:
        raise HTTPException(status_code=404, detail="Sales order not found.")
    if sales_order.contact_id != data.contact_id:
        raise HTTPException(
            status_code=400,
            detail="The selected contact does not match this sales order's customer.",
        )

    transaction = Transaction(
        contact_id=data.contact_id,
        sales_order_id=data.sales_order_id,
        amount=data.amount,
        date=data.date or datetime.utcnow(),
        status=data.status,
        created_by=current_user.id,
    )

    try:
        db.add(transaction)
        db.flush()

        invoice = db.query(Invoice).filter(Invoice.sales_order_id == sales_order.id).first()
        should_invoice = sales_order.customer_user_id is None or data.status.lower() in {"paid", "completed"}
        invoice_created = should_invoice and invoice is None
        if sales_order.customer_user_id and data.status.lower() in {"paid", "completed"}:
            sales_order.payment_status = "paid"
        if should_invoice and invoice is None:
            invoice = Invoice(
                user_id=current_user.id,
                sales_order_id=sales_order.id,
                transaction_id=transaction.id,
            )
            db.add(invoice)
            db.flush()

        db.commit()
        db.refresh(transaction)
        if invoice:
            db.refresh(invoice)
        return {
            **TransactionResponse.model_validate(transaction).model_dump(),
            "invoice_id": invoice.id if invoice else None,
            "invoice_number": f"INV-{invoice.id:06d}" if invoice else None,
            "invoice_created": invoice_created,
        }
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Invalid contact_id or sales_order_id.",
        )


# View All: Admin + Manager
@router.get("/", response_model=list[TransactionResponse])
def get_transactions(
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles([UserRole.ADMIN, UserRole.MANAGER])
    ),
):
    return db.query(Transaction).order_by(Transaction.id).all()


# View One: Admin + Manager
@router.get("/{transaction_id}", response_model=TransactionResponse)
def get_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles([UserRole.ADMIN, UserRole.MANAGER])
    ),
):
    transaction = db.get(Transaction, transaction_id)

    if transaction is None:
        raise HTTPException(status_code=404, detail="Transaction not found")

    return transaction


# Update: Admin only
@router.put("/{transaction_id}", response_model=TransactionResponse)
def update_transaction(
    transaction_id: int,
    data: TransactionCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles([UserRole.ADMIN])),
):
    transaction = db.get(Transaction, transaction_id)

    if transaction is None:
        raise HTTPException(status_code=404, detail="Transaction not found")

    transaction.contact_id = data.contact_id
    transaction.sales_order_id = data.sales_order_id
    transaction.amount = data.amount
    transaction.date = data.date or transaction.date
    transaction.status = data.status

    try:
        db.commit()
        db.refresh(transaction)
        return transaction
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Invalid contact_id or sales_order_id.",
        )


# Delete: Admin only
@router.delete("/{transaction_id}", status_code=204)
def delete_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles([UserRole.ADMIN])),
):
    transaction = db.get(Transaction, transaction_id)

    if transaction is None:
        raise HTTPException(status_code=404, detail="Transaction not found")

    db.delete(transaction)
    db.commit()

    return Response(status_code=204)
