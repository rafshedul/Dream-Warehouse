
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.dependencies import require_roles
from app.core.roles import UserRole
from app.database import get_db

from app.models.user import User
from app.models.product import Product
from app.models.customer import Customer
from app.models.sales_order import SalesOrder
from app.models.shipment import Shipment
from app.models.stock import Stock


router = APIRouter(
    prefix="/staff",
    tags=["Staff"],
)


@router.get("/profile")
def staff_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles([UserRole.STAFF])
    ),
):

    # Recent Sales Orders
    recent_sales_orders = (
        db.query(SalesOrder)
        .order_by(SalesOrder.created_at.desc())
        .limit(10)
        .all()
    )

    # Recent Customers
    recent_customers = (
        db.query(Customer)
        .order_by(Customer.created_at.desc())
        .limit(10)
        .all()
    )

    # Recent Shipments
    recent_shipments = (
        db.query(Shipment)
        .order_by(Shipment.date.desc())
        .limit(10)
        .all()
    )

    # Sales Statistics
    total_sales_orders = db.query(SalesOrder).count()

    my_sales_orders = (
        db.query(SalesOrder)
        .filter(SalesOrder.created_by == current_user.id)
        .count()
    )

    # Customer Statistics
    total_customers = db.query(Customer).count()

    # Shipment Statistics
    total_shipments = db.query(Shipment).count()

    pending_shipments = (
        db.query(Shipment)
        .filter(Shipment.status == "pending")
        .count()
    )

    # Product Statistics
    total_products = db.query(Product).count()

    # Low Stock Products
    low_stock_products = (
        db.query(Product.id)
        .outerjoin(Stock, Stock.product_id == Product.id)
        .group_by(Product.id)
        .having(
            func.coalesce(func.sum(Stock.quantity), 0) < 100
        )
        .count()
    )

    return {
        "message": "Welcome to Staff Profile",

        "profile": {
            "user_id": current_user.id,
            "name": current_user.contact.name,
            "email": current_user.email,
            "phone": current_user.contact.phone,
            "address": current_user.contact.address,
            "role": current_user.role,
            "is_active": current_user.is_active,
            "created_at": current_user.created_at,
        },

        "activities": {

            "recent_sales_orders": [
                {
                    "sales_order_id": order.id,
                    "contact_id": order.contact_id,
                    "total_amount": order.total_amount,
                    "created_by": order.created_by,
                    "creator_name": (
                        order.creator.contact.name
                        if order.creator and order.creator.contact
                        else None
                    ),
                    "created_at": order.created_at,
                }
                for order in recent_sales_orders
            ],

            "recent_customers": [
                {
                    "customer_id": customer.id,
                    "contact_id": customer.contact_id,
                    "company_name": customer.company_name,
                    "address": customer.address,
                    "created_at": customer.created_at,
                }
                for customer in recent_customers
            ],

            "recent_shipments": [
                {
                    "shipment_id": shipment.id,
                    "sales_order_id": shipment.sales_order_id,
                    "warehouse_id": shipment.warehouse_id,
                    "contact_id": shipment.contact_id,
                    "tracking_number": shipment.tracking_number,
                    "status": shipment.status,
                    "created_by": shipment.created_by,
                    "creator_name": (
                        shipment.creator.contact.name
                        if shipment.creator and shipment.creator.contact
                        else None
                    ),
                    "date": shipment.date,
                }
                for shipment in recent_shipments
            ],
        },

        "dashboard": {
            "total_sales_orders": total_sales_orders,
            "my_sales_orders": my_sales_orders,
            "total_customers": total_customers,
            "total_shipments": total_shipments,
            "pending_shipments": pending_shipments,
            "total_products": total_products,
            "low_stock_products": low_stock_products,
        },
    }
