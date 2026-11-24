
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.purchase_order_item import PurchaseOrderItem
from app.schemas.purchase_order_item import (
    PurchaseOrderItemCreate,
    PurchaseOrderItemResponse,
)
from app.core.dependencies import require_roles
from app.core.roles import UserRole

router = APIRouter(
    prefix="/purchase-order-items",
    tags=["Purchase Order Items"],
)


# Create: Admin + Manager
@router.post("/", response_model=PurchaseOrderItemResponse, status_code=201)
def create_purchase_order_item(
    data: PurchaseOrderItemCreate,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles([UserRole.ADMIN, UserRole.MANAGER])
    ),
):
    item = PurchaseOrderItem(
        purchase_order_id=data.purchase_order_id,
        product_id=data.product_id,
        quantity=data.quantity,
        unit_price=data.unit_price,
        total_price=data.quantity * data.unit_price,
    )

    db.add(item)

    try:
        db.commit()
        db.refresh(item)
        return item
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Invalid purchase_order_id or product_id.",
        )


# View All: Admin + Manager
@router.get("/", response_model=list[PurchaseOrderItemResponse])
def get_purchase_order_items(
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles([UserRole.ADMIN, UserRole.MANAGER])
    ),
):
    return (
        db.query(PurchaseOrderItem)
        .order_by(PurchaseOrderItem.id)
        .all()
    )


# View One: Admin + Manager
@router.get("/{item_id}", response_model=PurchaseOrderItemResponse)
def get_purchase_order_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles([UserRole.ADMIN, UserRole.MANAGER])
    ),
):
    item = db.get(PurchaseOrderItem, item_id)

    if item is None:
        raise HTTPException(
            status_code=404,
            detail="Purchase Order Item not found",
        )

    return item


# Update: Admin + Manager
@router.put("/{item_id}", response_model=PurchaseOrderItemResponse)
def update_purchase_order_item(
    item_id: int,
    data: PurchaseOrderItemCreate,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles([UserRole.ADMIN, UserRole.MANAGER])
    ),
):
    item = db.get(PurchaseOrderItem, item_id)

    if item is None:
        raise HTTPException(
            status_code=404,
            detail="Purchase Order Item not found",
        )

    item.purchase_order_id = data.purchase_order_id
    item.product_id = data.product_id
    item.quantity = data.quantity
    item.unit_price = data.unit_price
    item.total_price = data.quantity * data.unit_price

    try:
        db.commit()
        db.refresh(item)
        return item
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Invalid purchase_order_id or product_id.",
        )


# Delete: Admin only
@router.delete("/{item_id}", status_code=204)
def delete_purchase_order_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles([UserRole.ADMIN])
    ),
):
    item = db.get(PurchaseOrderItem, item_id)

    if item is None:
        raise HTTPException(
            status_code=404,
            detail="Purchase Order Item not found",
        )

    db.delete(item)
    db.commit()

    return Response(status_code=204)
