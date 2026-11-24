
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.dependencies import require_roles
from app.core.roles import UserRole
from app.database import get_db

from app.models.user import User
from app.models.product import Product
from app.models.category import Category
from app.models.supplier import Supplier
from app.models.customer import Customer
from app.models.warehouse import Warehouse
from app.models.purchase import PurchaseOrder
from app.models.sales_order import SalesOrder
from app.models.invoice import Invoice
from app.models.transaction import Transaction
from app.models.shipment import Shipment
from app.models.stock import Stock
from app.models.stock_activity import StockActivity


router = APIRouter(
    prefix="/admin",
    tags=["Admin"],
)


@router.get("/profile")
def admin_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles([UserRole.ADMIN])
    ),
):

    # User Statistics
    total_users = db.query(User).count()

    recent_registrations = (
        db.query(User)
        .order_by(User.created_at.desc())
        .limit(10)
        .all()
    )

    # Product Statistics
    total_products = db.query(Product).count()
    total_categories = db.query(Category).count()

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
    recent_products = (
        db.query(Product)
        .order_by(Product.created_at.desc())
        .limit(10)
        .all()
    )

    # Recent Sales Orders
    recent_sales_orders = (
        db.query(SalesOrder)
        .order_by(SalesOrder.created_at.desc())
        .limit(10)
        .all()
    )

    # Recent Purchase Orders
    recent_purchase_orders = (
        db.query(PurchaseOrder)
        .order_by(PurchaseOrder.created_at.desc())
        .limit(10)
        .all()
    )

    # Recent Stock Activities
    recent_stock_activities = (
        db.query(StockActivity)
        .order_by(StockActivity.date.desc())
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

    # Recent Transactions
    recent_transactions = (
        db.query(Transaction)
        .order_by(Transaction.date.desc())
        .limit(10)
        .all()
    )

    # Business Partner Statistics
    total_suppliers = db.query(Supplier).count()
    total_customers = db.query(Customer).count()

    # Warehouse Statistics
    total_warehouses = db.query(Warehouse).count()

    # Purchase & Sales Statistics
    total_purchase_orders = db.query(PurchaseOrder).count()
    total_sales_orders = db.query(SalesOrder).count()

    # Finance Statistics
    total_invoices = db.query(Invoice).count()
    total_transactions = db.query(Transaction).count()

    # Shipment Statistics
    total_shipments = db.query(Shipment).count()

    pending_shipments = (
        db.query(Shipment)
        .filter(Shipment.status == "pending")
        .count()
    )

    # Inventory Statistics
    total_stock_records = db.query(Stock).count()

    total_stock_quantity = (
        db.query(
            func.coalesce(func.sum(Stock.quantity), 0)
        ).scalar()
    )

    total_stock_activities = db.query(StockActivity).count()

    return {
        "message": "Welcome to Admin Profile",

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

            "recent_registrations": [
                {
                    "user_id": user.id,
                    "name": user.contact.name,
                    "email": user.email,
                    "role": user.role,
                    "is_active": user.is_active,
                    "registered_at": user.created_at,
                }
                for user in recent_registrations
            ],

            "recent_products": [
                {
                    "product_id": product.id,
                    "name": product.name,
                    "sku": product.sku,
                    "created_by": product.created_by,
                    "creator_name": (
                        product.creator.contact.name
                        if product.creator and product.creator.contact
                        else None
                    ),
                    "created_at": product.created_at,
                }
                for product in recent_products
            ],

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

            "recent_purchase_orders": [
                {
                    "purchase_order_id": order.id,
                    "supplier_id": order.supplier_id,
                    "total_amount": order.total_amount,
                    "created_by": order.created_by,
                    "creator_name": (
                        order.creator.contact.name
                        if order.creator and order.creator.contact
                        else None
                    ),
                    "created_at": order.created_at,
                }
                for order in recent_purchase_orders
            ],

            "recent_stock_activities": [
                {
                    "activity_id": activity.id,
                    "product_id": activity.product_id,
                    "product_name": (
                        activity.product.name
                        if activity.product
                        else None
                    ),
                    "warehouse_id": activity.warehouse_id,
                    "movement_type": activity.movement_type,
                    "created_by": activity.created_by,
                    "creator_name": (
                        activity.creator.contact.name
                        if activity.creator and activity.creator.contact
                        else None
                    ),
                    "date": activity.date,
                }
                for activity in recent_stock_activities
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

            "recent_transactions": [
                {
                    "transaction_id": transaction.id,
                    "contact_id": transaction.contact_id,
                    "sales_order_id": transaction.sales_order_id,
                    "amount": transaction.amount,
                    "status": transaction.status,
                    "created_by": transaction.created_by,
                    "creator_name": (
                        transaction.creator.contact.name
                        if transaction.creator and transaction.creator.contact
                        else None
                    ),
                    "date": transaction.date,
                }
                for transaction in recent_transactions
            ],
        },

        "dashboard": {
            "total_users": total_users,
            "total_products": total_products,
            "total_categories": total_categories,
            "total_suppliers": total_suppliers,
            "total_customers": total_customers,
            "total_warehouses": total_warehouses,

            "total_purchase_orders": total_purchase_orders,
            "total_sales_orders": total_sales_orders,

            "total_invoices": total_invoices,
            "total_transactions": total_transactions,

            "total_shipments": total_shipments,
            "pending_shipments": pending_shipments,

            "total_stock_records": total_stock_records,
            "total_stock_quantity": total_stock_quantity,
            "total_stock_activities": total_stock_activities,

            "low_stock_products": low_stock_products,
        },
    }
