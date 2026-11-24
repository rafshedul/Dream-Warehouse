
import re
from decimal import Decimal
from math import ceil
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import and_, exists, func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.category import Category
from app.models.contact import Contact
from app.models.invoice import Invoice
from app.models.product import Product
from app.models.sales_order import SalesOrder
from app.models.sales_order_item import SalesOrderItem
from app.models.shipment import Shipment
from app.models.user import User
from app.models.warehouse import Warehouse
from app.schemas.sales_order import (
    SalesOrderCreate,
    SalesOrderDetailResponse,
    SalesOrderListRow,
    SalesOrderResponse,
    SalesOrderSearchResponse,
    SalesOrderWithItemsCreate,
)
from app.core.dependencies import require_roles
from app.core.roles import UserRole


router = APIRouter(
    prefix="/sales-orders",
    tags=["Sales Orders"]
)


@router.post("/with-items", response_model=SalesOrderResponse, status_code=201)
def create_sales_order_with_items(
    data: SalesOrderWithItemsCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF])
    ),
):
    """Create a sales order, its item lines, and calculated total atomically."""
    total_amount = sum(
        (line.unit_price * line.quantity for line in data.items),
        start=Decimal("0.00"),
    )
    order = SalesOrder(
        contact_id=data.contact_id,
        total_amount=total_amount,
        created_by=current_user.id,
    )
    db.add(order)

    try:
        db.flush()
        for line in data.items:
            db.add(
                SalesOrderItem(
                    sales_order_id=order.id,
                    product_id=line.product_id,
                    quantity=line.quantity,
                    unit_price=line.unit_price,
                    total_price=line.unit_price * line.quantity,
                )
            )
        db.commit()
        db.refresh(order)
        return order
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Invalid contact_id or product_id, or database constraint violation",
        )


# Create: Admin + Manager + Staff
@router.post("/", response_model=SalesOrderResponse, status_code=201)
def create_sales_order(
    data: SalesOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles([
            UserRole.ADMIN,
            UserRole.MANAGER,
            UserRole.STAFF
        ])
    ),
):
    order = SalesOrder(
        **data.model_dump(),
        created_by=current_user.id
    )

    db.add(order)

    try:
        db.commit()
        db.refresh(order)
        return order

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Invalid contact_id. Contact does not exist.",
        )


ORDER_VIEWS = ("all", "online", "unpaid", "to_ship", "shipped", "delivered", "cancelled", "refund")
OrderView = Literal["all", "online", "unpaid", "to_ship", "shipped", "delivered", "cancelled", "refund"]


def _view_clause(view: str):
    """Work-queue tabs for staff. 'unpaid' includes cash-on-delivery orders still to be collected."""
    online = SalesOrder.customer_user_id.isnot(None)
    if view == "online":
        return online
    if view == "unpaid":
        return and_(
            online,
            SalesOrder.payment_status.in_(("pending", "due")),
            SalesOrder.order_status != "cancelled",
        )
    if view == "to_ship":
        return and_(
            online,
            SalesOrder.order_status == "processing",
            or_(SalesOrder.payment_status == "paid", SalesOrder.payment_method == "cod"),
        )
    if view == "shipped":
        return SalesOrder.order_status == "shipped"
    if view == "delivered":
        return SalesOrder.order_status == "delivered"
    if view == "cancelled":
        return SalesOrder.order_status == "cancelled"
    if view == "refund":
        return SalesOrder.order_status == "refund_required"
    return None


def _source(order: SalesOrder) -> str:
    return "online" if order.customer_user_id is not None else "internal"


def _order_number(order_id: int) -> str:
    return f"SO-{order_id:06d}"


# Search / filter / paginate: Admin + Manager + Staff
@router.get("/search", response_model=SalesOrderSearchResponse)
def search_sales_orders(
    view: OrderView = "all",
    source: Literal["online", "internal"] | None = None,
    payment_status: str | None = Query(default=None, max_length=30),
    order_status: str | None = Query(default=None, max_length=30),
    payment_method: str | None = Query(default=None, max_length=30),
    q: str | None = Query(default=None, max_length=100),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF])
    ),
):
    query = db.query(SalesOrder, Contact).join(Contact, Contact.id == SalesOrder.contact_id)

    clause = _view_clause(view)
    if clause is not None:
        query = query.filter(clause)
    if source == "online":
        query = query.filter(SalesOrder.customer_user_id.isnot(None))
    elif source == "internal":
        query = query.filter(SalesOrder.customer_user_id.is_(None))
    if payment_status:
        query = query.filter(SalesOrder.payment_status == payment_status)
    if order_status:
        query = query.filter(SalesOrder.order_status == order_status)
    if payment_method:
        query = query.filter(SalesOrder.payment_method == payment_method)

    term = (q or "").strip()
    if term:
        like = f"%{term}%"
        conditions = [
            Contact.name.ilike(like),
            Contact.phone.ilike(like),
            SalesOrder.shipping_phone.ilike(like),
            exists().where(
                Shipment.sales_order_id == SalesOrder.id,
                Shipment.tracking_number.ilike(like),
            ),
        ]
        digits = re.sub(r"^so-?", "", term, flags=re.IGNORECASE)
        if digits.isdigit():
            conditions.append(SalesOrder.id == int(digits))
        query = query.filter(or_(*conditions))

    total = query.count()
    rows = (
        query.order_by(SalesOrder.id.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    item_counts = {}
    if rows:
        item_counts = dict(
            db.query(SalesOrderItem.sales_order_id, func.count(SalesOrderItem.id))
            .filter(SalesOrderItem.sales_order_id.in_([order.id for order, _ in rows]))
            .group_by(SalesOrderItem.sales_order_id)
            .all()
        )

    counts = {"all": db.query(func.count(SalesOrder.id)).scalar() or 0}
    for name in ORDER_VIEWS:
        view_clause = _view_clause(name)
        if view_clause is not None:
            counts[name] = (
                db.query(func.count(SalesOrder.id)).filter(view_clause).scalar() or 0
            )

    return SalesOrderSearchResponse(
        orders=[
            SalesOrderListRow(
                id=order.id,
                order_number=_order_number(order.id),
                source=_source(order),
                created_at=order.created_at,
                customer_name=contact.name,
                customer_phone=order.shipping_phone or contact.phone,
                total_amount=float(order.total_amount),
                shipping_fee=float(order.shipping_fee or 0),
                payment_method=order.payment_method,
                payment_status=order.payment_status,
                order_status=order.order_status,
                item_count=int(item_counts.get(order.id, 0)),
            )
            for order, contact in rows
        ],
        total=total,
        page=page,
        limit=limit,
        total_pages=max(ceil(total / limit), 1),
        counts=counts,
    )


# Full detail for fulfilment: Admin + Manager + Staff
@router.get("/{order_id}/detail", response_model=SalesOrderDetailResponse)
def get_sales_order_detail(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF])
    ),
):
    order = db.get(SalesOrder, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Sales Order not found")

    contact = db.get(Contact, order.contact_id)
    email = order.shipping_email
    if not email and order.customer_user_id:
        customer = db.get(User, order.customer_user_id)
        email = customer.email if customer else None

    lines = (
        db.query(SalesOrderItem, Product, Category)
        .join(Product, Product.id == SalesOrderItem.product_id)
        .outerjoin(Category, Category.id == Product.category_id)
        .filter(SalesOrderItem.sales_order_id == order.id)
        .order_by(SalesOrderItem.id)
        .all()
    )

    shipment_row = (
        db.query(Shipment, Warehouse)
        .outerjoin(Warehouse, Warehouse.id == Shipment.warehouse_id)
        .filter(Shipment.sales_order_id == order.id)
        .order_by(Shipment.id.desc())
        .first()
    )
    shipment, shipment_warehouse = shipment_row if shipment_row else (None, None)
    invoice = db.query(Invoice).filter(Invoice.sales_order_id == order.id).first()
    fulfillment_warehouse = (
        db.get(Warehouse, order.fulfillment_warehouse_id)
        if order.fulfillment_warehouse_id
        else None
    )

    return {
        "id": order.id,
        "order_number": _order_number(order.id),
        "source": _source(order),
        "created_at": order.created_at,
        "customer_name": contact.name if contact else None,
        "customer_phone": contact.phone if contact else None,
        "customer_email": email,
        "shipping_address": order.shipping_address or (contact.address if contact else None),
        "shipping_phone": order.shipping_phone,
        "delivery_note": order.delivery_note,
        "total_amount": float(order.total_amount),
        "shipping_fee": float(order.shipping_fee or 0),
        "payment_method": order.payment_method,
        "payment_status": order.payment_status,
        "order_status": order.order_status,
        "fulfillment_warehouse_name": fulfillment_warehouse.name if fulfillment_warehouse else None,
        "items": [
            {
                "id": line.id,
                "product_id": line.product_id,
                "product_name": product.name,
                "sku": product.sku,
                "category_name": category.name if category else None,
                "quantity": line.quantity,
                "unit_price": float(line.unit_price),
                "total_price": float(line.total_price),
            }
            for line, product, category in lines
        ],
        "shipment": (
            {
                "id": shipment.id,
                "tracking_number": shipment.tracking_number,
                "status": shipment.status,
                "date": shipment.date,
                "warehouse_name": shipment_warehouse.name if shipment_warehouse else None,
            }
            if shipment is not None
            else None
        ),
        "invoice_number": f"INV-{invoice.id:06d}" if invoice else None,
    }


# View All: Admin + Manager + Staff
@router.get("/", response_model=list[SalesOrderResponse])
def get_sales_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles([
            UserRole.ADMIN,
            UserRole.MANAGER,
            UserRole.STAFF
        ])
    ),
):
    return db.query(SalesOrder).order_by(SalesOrder.id).all()


# View One: Admin + Manager + Staff
@router.get("/{order_id}", response_model=SalesOrderResponse)
def get_sales_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles([
            UserRole.ADMIN,
            UserRole.MANAGER,
            UserRole.STAFF
        ])
    ),
):
    order = db.get(SalesOrder, order_id)

    if order is None:
        raise HTTPException(
            status_code=404,
            detail="Sales Order not found",
        )

    return order


# Update:
# Admin + Manager: Any Sales Order
# Staff: Own Sales Orders only
@router.put("/{order_id}", response_model=SalesOrderResponse)
def update_sales_order(
    order_id: int,
    data: SalesOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles([
            UserRole.ADMIN,
            UserRole.MANAGER,
            UserRole.STAFF
        ])
    ),
):
    order = db.get(SalesOrder, order_id)

    if order is None:
        raise HTTPException(
            status_code=404,
            detail="Sales Order not found",
        )

    # Staff ownership check
    if (
        current_user.role == UserRole.STAFF.value
        and order.created_by != current_user.id
    ):
        raise HTTPException(
            status_code=403,
            detail="You can only update your own Sales Orders.",
        )

    for field, value in data.model_dump().items():
        setattr(order, field, value)

    try:
        db.commit()
        db.refresh(order)
        return order

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Invalid contact_id. Contact does not exist.",
        )


# Delete: Admin only
@router.delete("/{order_id}", status_code=204)
def delete_sales_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles([UserRole.ADMIN])
    ),
):
    order = db.get(SalesOrder, order_id)

    if order is None:
        raise HTTPException(
            status_code=404,
            detail="Sales Order not found",
        )

    db.delete(order)
    db.commit()

    return Response(status_code=204)
