from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.purchase import PurchaseOrder
from app.models.purchase_order_item import PurchaseOrderItem
from app.models.user import User
from app.schemas.purchase import PurchaseCreate, PurchaseResponse
from app.schemas.purchase_order_item import (
    PurchaseOrderWithItemsCreate,
)
from app.core.dependencies import require_roles
from app.core.roles import UserRole


router = APIRouter(
    prefix="/purchase-orders",
    tags=["Purchase Orders"],
)


@router.post("/with-items", response_model=PurchaseResponse, status_code=201)
def create_purchase_order_with_items(
    data: PurchaseOrderWithItemsCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles([UserRole.ADMIN, UserRole.MANAGER])
    ),
):
    """Create the order header and every item line atomically."""
    total_amount = sum(
        (line.unit_price * line.quantity for line in data.items),
        start=Decimal("0.00"),
    )
    purchase_values = {
        "supplier_id": data.supplier_id,
        "total_amount": total_amount,
        "created_by": current_user.id,
    }
    if data.date is not None:
        purchase_values["date"] = data.date
    purchase_order = PurchaseOrder(
        **purchase_values,
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
        db.commit()
        db.refresh(purchase_order)
        return purchase_order
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Invalid supplier_id or product_id, or database constraint violation",
        )


# Create: Admin + Manager
@router.post("/", response_model=PurchaseResponse, status_code=201)
def create_purchase_order(
    data: PurchaseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles([UserRole.ADMIN, UserRole.MANAGER])
    ),
):
    purchase_data = data.model_dump(exclude_none=True)

    purchase_order = PurchaseOrder(
        **purchase_data,
        created_by=current_user.id,
    )

    db.add(purchase_order)

    try:
        db.commit()
        db.refresh(purchase_order)
        return purchase_order
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Invalid supplier_id or database constraint violation",
        )


# Get All: Admin + Manager
@router.get("/", response_model=list[PurchaseResponse])
def get_purchase_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles([UserRole.ADMIN, UserRole.MANAGER])
    ),
):
    return (
        db.query(PurchaseOrder)
        .order_by(PurchaseOrder.id)
        .all()
    )


# Get One: Admin + Manager
@router.get("/{purchase_order_id}", response_model=PurchaseResponse)
def get_purchase_order(
    purchase_order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles([UserRole.ADMIN, UserRole.MANAGER])
    ),
):
    purchase_order = db.get(PurchaseOrder, purchase_order_id)

    if purchase_order is None:
        raise HTTPException(
            status_code=404,
            detail="Purchase Order not found",
        )

    return purchase_order


# Update: Admin + Manager
@router.put("/{purchase_order_id}", response_model=PurchaseResponse)
def update_purchase_order(
    purchase_order_id: int,
    data: PurchaseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles([UserRole.ADMIN, UserRole.MANAGER])
    ),
):
    purchase_order = db.get(PurchaseOrder, purchase_order_id)

    if purchase_order is None:
        raise HTTPException(
            status_code=404,
            detail="Purchase Order not found",
        )

    purchase_data = data.model_dump(exclude_none=True)

    for field, value in purchase_data.items():
        setattr(purchase_order, field, value)

    try:
        db.commit()
        db.refresh(purchase_order)
        return purchase_order
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Invalid supplier_id or database constraint violation",
        )


# Delete: Admin only
@router.delete("/{purchase_order_id}", status_code=204)
def delete_purchase_order(
    purchase_order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles([UserRole.ADMIN])
    ),
):
    purchase_order = db.get(PurchaseOrder, purchase_order_id)

    if purchase_order is None:
        raise HTTPException(
            status_code=404,
            detail="Purchase Order not found",
        )

    db.delete(purchase_order)
    db.commit()

    return Response(status_code=204)
