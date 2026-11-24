
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.shipment import Shipment
from app.models.sales_order import SalesOrder
from app.models.user import User
from app.schemas.shipment import ShipmentCreate, ShipmentResponse
from app.core.dependencies import require_roles
from app.core.roles import UserRole


router = APIRouter(
    prefix="/shipments",
    tags=["Shipments"],
)


# Create: Admin, Manager, Staff. Online customer orders must be paid first unless COD.
@router.post("/", response_model=ShipmentResponse, status_code=201)
def create_shipment(
    data: ShipmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF])),
):
    order = db.get(SalesOrder, data.sales_order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Sales order not found.")
    if order.customer_user_id and order.payment_method == "sslcommerz" and order.payment_status != "paid":
        raise HTTPException(status_code=409, detail="Online order must be paid before shipment.")
    if order.fulfillment_warehouse_id and data.warehouse_id != order.fulfillment_warehouse_id:
        raise HTTPException(status_code=400, detail="Shipment warehouse must match the order's reserved warehouse.")
    shipment = Shipment(
        sales_order_id=data.sales_order_id,
        warehouse_id=data.warehouse_id,
        contact_id=data.contact_id,
        tracking_number=data.tracking_number,
        date=data.date or datetime.utcnow(),
        status=data.status,
        created_by=current_user.id,
    )

    db.add(shipment)

    try:
        db.commit()
        db.refresh(shipment)
        order.order_status = "shipped"
        db.commit()
        db.refresh(shipment)
        return shipment
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Invalid foreign key ID or duplicate tracking_number.",
        )


# View All: Admin + Manager + Staff
@router.get("/", response_model=list[ShipmentResponse])
def get_shipments(
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles([
            UserRole.ADMIN,
            UserRole.MANAGER,
            UserRole.STAFF
        ])
    ),
):
    return db.query(Shipment).order_by(Shipment.id).all()


# View One: Admin + Manager + Staff
@router.get("/{shipment_id}", response_model=ShipmentResponse)
def get_shipment(
    shipment_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles([
            UserRole.ADMIN,
            UserRole.MANAGER,
            UserRole.STAFF
        ])
    ),
):
    shipment = db.get(Shipment, shipment_id)

    if shipment is None:
        raise HTTPException(
            status_code=404,
            detail="Shipment not found"
        )

    return shipment


# Update Full Shipment: Admin + Manager
@router.put("/{shipment_id}", response_model=ShipmentResponse)
def update_shipment(
    shipment_id: int,
    data: ShipmentCreate,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles([
            UserRole.ADMIN,
            UserRole.MANAGER
        ])
    ),
):
    shipment = db.get(Shipment, shipment_id)

    if shipment is None:
        raise HTTPException(
            status_code=404,
            detail="Shipment not found"
        )

    shipment.sales_order_id = data.sales_order_id
    shipment.warehouse_id = data.warehouse_id
    shipment.contact_id = data.contact_id
    shipment.tracking_number = data.tracking_number
    shipment.date = data.date or shipment.date
    shipment.status = data.status

    try:
        db.commit()
        db.refresh(shipment)
        return shipment
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Invalid foreign key ID or duplicate tracking_number.",
        )


# Update Shipment Status Only: Admin + Manager + Staff
@router.patch("/{shipment_id}/status")
def update_shipment_status(
    shipment_id: int,
    status: str,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles([
            UserRole.ADMIN,
            UserRole.MANAGER,
            UserRole.STAFF
        ])
    ),
):
    shipment = db.get(Shipment, shipment_id)

    if shipment is None:
        raise HTTPException(
            status_code=404,
            detail="Shipment not found"
        )

    shipment.status = status

    order = db.get(SalesOrder, shipment.sales_order_id)
    if order:
        normalized = status.strip().lower().replace(" ", "_")
        if normalized in {"pending", "processing", "packed", "shipped", "in_transit", "delivered", "returned"}:
            order.order_status = normalized

    db.commit()
    db.refresh(shipment)

    return {
        "message": "Shipment status updated successfully",
        "shipment_id": shipment.id,
        "status": shipment.status
    }


# Delete: Admin only
@router.delete("/{shipment_id}", status_code=204)
def delete_shipment(
    shipment_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles([UserRole.ADMIN])),
):
    shipment = db.get(Shipment, shipment_id)

    if shipment is None:
        raise HTTPException(
            status_code=404,
            detail="Shipment not found"
        )

    db.delete(shipment)
    db.commit()

    return Response(status_code=204)
