
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.sales_order_item import SalesOrderItem
from app.schemas.sales_order_item import (
    SalesOrderItemCreate,
    SalesOrderItemResponse,
)
from app.core.dependencies import require_roles
from app.core.roles import UserRole

router = APIRouter(
    prefix="/sales-order-items",
    tags=["Sales Order Items"],
)


# Create: Admin + Manager
@router.post("/", response_model=SalesOrderItemResponse, status_code=201)
def create_sales_order_item(
    data: SalesOrderItemCreate,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles([UserRole.ADMIN, UserRole.MANAGER])
    ),
):
    total_price = data.quantity * data.unit_price

    item = SalesOrderItem(
        product_id=data.product_id,
        sales_order_id=data.sales_order_id,
        quantity=data.quantity,
        unit_price=data.unit_price,
        total_price=total_price,
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
            detail="Invalid product_id or sales_order_id.",
        )


# View All: Admin + Manager + Staff (read-only operational dashboard and sales view)
@router.get("/", response_model=list[SalesOrderItemResponse])
def get_sales_order_items(
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF])
    ),
):
    return db.query(SalesOrderItem).order_by(SalesOrderItem.id).all()


# View One: Admin + Manager
@router.get("/{item_id}", response_model=SalesOrderItemResponse)
def get_sales_order_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles([UserRole.ADMIN, UserRole.MANAGER])
    ),
):
    item = db.get(SalesOrderItem, item_id)

    if item is None:
        raise HTTPException(
            status_code=404,
            detail="Sales Order Item not found",
        )

    return item


# Update: Admin + Manager
@router.put("/{item_id}", response_model=SalesOrderItemResponse)
def update_sales_order_item(
    item_id: int,
    data: SalesOrderItemCreate,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles([UserRole.ADMIN, UserRole.MANAGER])
    ),
):
    item = db.get(SalesOrderItem, item_id)

    if item is None:
        raise HTTPException(
            status_code=404,
            detail="Sales Order Item not found",
        )

    item.product_id = data.product_id
    item.sales_order_id = data.sales_order_id
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
            detail="Invalid product_id or sales_order_id.",
        )


# Delete: Admin only
@router.delete("/{item_id}", status_code=204)
def delete_sales_order_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles([UserRole.ADMIN])
    ),
):
    item = db.get(SalesOrderItem, item_id)

    if item is None:
        raise HTTPException(
            status_code=404,
            detail="Sales Order Item not found",
        )

    db.delete(item)
    db.commit()

    return Response(status_code=204)
