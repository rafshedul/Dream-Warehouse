from collections import Counter
from decimal import Decimal, ROUND_HALF_UP
import secrets

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.dependencies import require_roles
from app.core.payment import (
    DELIVERY_FEE_BDT, FRONTEND_BASE_URL, PUBLIC_API_URL,
    PAYMENT_WINDOW_MINUTES, SSLCOMMERZ_BASE_URL, SSLCOMMERZ_STORE_ID,
    SSLCOMMERZ_STORE_PASSWORD, sslcommerz_configured,
)
from app.core.roles import UserRole
from app.database import get_db
from app.models.category import Category
from app.models.contact import Contact
from app.models.invoice import Invoice
from app.models.product import Product
from app.models.sales_order import SalesOrder
from app.models.sales_order_item import SalesOrderItem
from app.models.shipment import Shipment
from app.models.stock import Stock
from app.models.stock_activity import StockActivity
from app.models.transaction import Transaction
from app.models.user import User
from app.models.warehouse import Warehouse
from app.schemas.storefront import CartValidateRequest, StorefrontCheckoutCreate
from app.services.order_inventory import expire_unpaid_online_orders, release_order_stock

router = APIRouter(prefix="/storefront", tags=["Online Store"])


def _order_payload(db: Session, order: SalesOrder) -> dict:
    rows = (
        db.query(SalesOrderItem, Product, Category)
        .join(Product, Product.id == SalesOrderItem.product_id)
        .join(Category, Category.id == Product.category_id)
        .filter(SalesOrderItem.sales_order_id == order.id)
        .all()
    )
    shipment = db.query(Shipment).filter(Shipment.sales_order_id == order.id).order_by(Shipment.id.desc()).first()
    return {
        "id": order.id,
        "order_number": f"SO-{order.id:06d}",
        "created_at": order.created_at.isoformat() if order.created_at else "",
        "total_amount": float(order.total_amount),
        "shipping_fee": float(order.shipping_fee or 0),
        "payment_method": order.payment_method,
        "payment_status": order.payment_status,
        "order_status": order.order_status,
        "shipping_address": order.shipping_address,
        "shipping_phone": order.shipping_phone,
        "tracking_number": shipment.tracking_number if shipment else None,
        "invoice_number": None,
        "items": [
            {
                "id": line.id,
                "product_id": line.product_id,
                "product_name": product.name,
                "sku": product.sku,
                "category_name": category.name,
                "quantity": line.quantity,
                "unit_price": float(line.unit_price),
                "total_price": float(line.total_price),
            }
            for line, product, category in rows
        ],
    }


@router.post("/cart/validate")
def validate_cart(data: CartValidateRequest, db: Session = Depends(get_db)):
    """Public: current price and availability for cart lines, so the cart never shows stale data."""
    quantities = Counter()
    for line in data.items:
        quantities[line.product_id] += line.quantity
    products = {
        product.id: product
        for product in db.query(Product).filter(Product.id.in_(quantities.keys())).all()
    }
    totals = dict(
        db.query(Stock.product_id, func.coalesce(func.sum(Stock.quantity), 0))
        .filter(Stock.product_id.in_(quantities.keys()))
        .group_by(Stock.product_id)
        .all()
    )
    stocks = db.query(Stock).filter(Stock.product_id.in_(quantities.keys())).all()
    by_warehouse: dict[int, dict[int, int]] = {}
    for stock in stocks:
        by_warehouse.setdefault(stock.warehouse_id, {})[stock.product_id] = stock.quantity
    fulfillable = all(pid in products for pid in quantities) and any(
        all(qty_map.get(pid, 0) >= qty for pid, qty in quantities.items())
        for qty_map in by_warehouse.values()
    )
    return {
        "fulfillable": fulfillable,
        "items": [
            {
                "product_id": pid,
                "exists": pid in products,
                "name": products[pid].name if pid in products else None,
                "unit_price": float(products[pid].unit_price) if pid in products else None,
                "available": int(totals.get(pid, 0)),
            }
            for pid in quantities
        ],
    }


@router.post("/checkout", status_code=201)
async def create_checkout(
    data: StorefrontCheckoutCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.USER])),
):
    if data.payment_method == "sslcommerz" and not sslcommerz_configured():
        raise HTTPException(503, "Online card/mobile banking is not configured yet. Choose Cash on Delivery or configure SSLCommerz credentials.")
    expire_unpaid_online_orders(db, PAYMENT_WINDOW_MINUTES)
    quantities = Counter()
    for line in data.items:
        quantities[line.product_id] += line.quantity
    if any(quantity > 5000 for quantity in quantities.values()):
        raise HTTPException(422, "The maximum quantity for a product is 5,000.")

    products = {
        product.id: product
        for product in db.query(Product).filter(Product.id.in_(quantities.keys())).all()
    }
    if products.keys() != quantities.keys():
        raise HTTPException(404, "One or more selected products no longer exist.")

    stocks = (
        db.query(Stock)
        .filter(Stock.product_id.in_(quantities.keys()), Stock.quantity > 0)
        .order_by(Stock.warehouse_id, Stock.product_id)
        .with_for_update()
        .all()
    )
    by_warehouse: dict[int, dict[int, Stock]] = {}
    for stock in stocks:
        by_warehouse.setdefault(stock.warehouse_id, {})[stock.product_id] = stock
    matching = [
        (warehouse_id, stock_map)
        for warehouse_id, stock_map in by_warehouse.items()
        if all(pid in stock_map and stock_map[pid].quantity >= qty for pid, qty in quantities.items())
    ]
    if not matching:
        available = {
            products[pid].name: sum(stock.quantity for stock in stocks if stock.product_id == pid)
            for pid in quantities
        }
        raise HTTPException(409, {"message": "There is not enough stock to complete this order.", "available": available})
    warehouse_id, warehouse_stocks = matching[0]
    contact = db.get(Contact, current_user.contact_id)
    if contact is None:
        raise HTTPException(400, "Your account profile has no delivery contact. Update your profile first.")

    try:
        fee = Decimal(DELIVERY_FEE_BDT).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    except Exception:
        raise HTTPException(500, "DELIVERY_FEE_BDT must be a valid decimal amount.")
    item_total = sum(
        (Decimal(products[pid].unit_price) * qty for pid, qty in quantities.items()),
        Decimal("0.00"),
    ).quantize(Decimal("0.01"))
    total = item_total + fee
    if data.payment_method == "sslcommerz" and not (Decimal("10.00") <= total <= Decimal("500000.00")):
        raise HTTPException(422, "SSLCommerz online payments must be between ৳10 and ৳500,000 per order.")

    order = SalesOrder(
        contact_id=contact.id,
        created_by=current_user.id,
        customer_user_id=current_user.id,
        fulfillment_warehouse_id=warehouse_id,
        total_amount=total,
        shipping_fee=fee,
        order_status="processing",
        payment_status="pending" if data.payment_method == "sslcommerz" else "due",
        payment_method=data.payment_method,
        shipping_address=data.shipping_address.strip(),
        shipping_phone=data.shipping_phone.strip(),
        shipping_email=str(current_user.email),
        delivery_note=(data.delivery_note or "").strip() or None,
    )
    db.add(order)
    try:
        db.flush()
        for pid, qty in quantities.items():
            product = products[pid]
            stock = warehouse_stocks[pid]
            stock.quantity -= qty
            db.add(SalesOrderItem(
                product_id=pid,
                sales_order_id=order.id,
                quantity=qty,
                unit_price=product.unit_price,
                total_price=Decimal(product.unit_price) * qty,
            ))
            db.add(StockActivity(
                product_id=pid,
                warehouse_id=warehouse_id,
                quantity=qty,
                movement_type="OUT",
                created_by=current_user.id,
            ))

        transaction = None
        if data.payment_method == "sslcommerz":
            transaction = Transaction(
                contact_id=contact.id,
                sales_order_id=order.id,
                amount=total,
                status="initiated",
                gateway_tran_id=f"DW{order.id}{secrets.token_hex(8)}"[:30],
                created_by=current_user.id,
            )
            db.add(transaction)
        db.commit()
        db.refresh(order)
        if transaction:
            db.refresh(transaction)
    except Exception:
        db.rollback()
        raise

    payment_url = None
    if transaction:
        form = {
            "store_id": SSLCOMMERZ_STORE_ID,
            "store_passwd": SSLCOMMERZ_STORE_PASSWORD,
            "total_amount": f"{total:.2f}",
            "currency": "BDT",
            "tran_id": transaction.gateway_tran_id,
            "success_url": f"{PUBLIC_API_URL}/payments/sslcommerz/success",
            "fail_url": f"{PUBLIC_API_URL}/payments/sslcommerz/fail",
            "cancel_url": f"{PUBLIC_API_URL}/payments/sslcommerz/cancel",
            "ipn_url": f"{PUBLIC_API_URL}/payments/sslcommerz/ipn",
            "cus_name": contact.name[:150],
            "cus_email": current_user.email,
            "cus_phone": data.shipping_phone[:20],
            "cus_add1": data.shipping_address[:200],
            "cus_city": "Bangladesh",
            "cus_country": "Bangladesh",
            "shipping_method": "YES",
            "ship_name": contact.name[:150],
            "ship_add1": data.shipping_address[:200],
            "ship_city": "Bangladesh",
            "ship_country": "Bangladesh",
            "product_name": "Dream Warehouse order",
            "product_category": "general",
            "product_profile": "general",
        }
        try:
            async with httpx.AsyncClient(timeout=25) as client:
                response = await client.post(
                    f"{SSLCOMMERZ_BASE_URL}/gwprocess/v4/api.php",
                    data=form,
                )
                response.raise_for_status()
                gateway = response.json()
            payment_url = gateway.get("GatewayPageURL")
            if not payment_url or gateway.get("status") != "SUCCESS":
                raise ValueError("SSLCommerz did not return a checkout URL.")
        except Exception as exc:
            transaction.status = "failed"
            order.payment_status = "failed"
            order.order_status = "cancelled"
            release_order_stock(db, order, current_user.id)
            db.commit()
            raise HTTPException(502, "Could not start SSLCommerz checkout. Reserved stock has been restored.") from exc

    return {
        "sales_order_id": order.id,
        "order_number": f"SO-{order.id:06d}",
        "amount": float(order.total_amount),
        "payment_method": order.payment_method,
        "payment_status": order.payment_status,
        "order_status": order.order_status,
        "payment_url": payment_url,
    }


@router.get("/orders")
def my_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.USER])),
):
    expire_unpaid_online_orders(db, PAYMENT_WINDOW_MINUTES)
    orders = db.query(SalesOrder).filter(
        SalesOrder.customer_user_id == current_user.id
    ).order_by(SalesOrder.created_at.desc(), SalesOrder.id.desc()).all()
    payload = [_order_payload(db, order) for order in orders]
    invoice_ids = {
        invoice.sales_order_id: invoice.id
        for invoice in db.query(Invoice).filter(Invoice.sales_order_id.in_([o.id for o in orders])).all()
    } if orders else {}
    for order_item in payload:
        invoice_id = invoice_ids.get(order_item["id"])
        order_item["invoice_number"] = f"INV-{invoice_id:06d}" if invoice_id else None
    return payload


@router.get("/orders/{order_id}")
def my_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.USER])),
):
    expire_unpaid_online_orders(db, PAYMENT_WINDOW_MINUTES)
    order = db.query(SalesOrder).filter(
        SalesOrder.id == order_id,
        SalesOrder.customer_user_id == current_user.id,
    ).first()
    if order is None:
        raise HTTPException(404, "Order not found.")
    payload = _order_payload(db, order)
    invoice = db.query(Invoice).filter(Invoice.sales_order_id == order.id).first()
    payload["invoice_number"] = f"INV-{invoice.id:06d}" if invoice else None
    return payload


@router.post("/orders/{order_id}/cancel")
def cancel_my_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.USER])),
):
    """Let a customer cancel an order that has not been paid online or shipped yet."""
    order = db.query(SalesOrder).filter(
        SalesOrder.id == order_id,
        SalesOrder.customer_user_id == current_user.id,
    ).with_for_update().first()
    if order is None:
        raise HTTPException(404, "Order not found.")
    if order.order_status != "processing" or order.payment_status == "paid":
        raise HTTPException(409, "This order can no longer be cancelled. Please contact support.")
    shipped = db.query(Shipment).filter(
        Shipment.sales_order_id == order.id,
        Shipment.status.notin_(["pending", "cancelled"]),
    ).first()
    if shipped:
        raise HTTPException(409, "This order has already been shipped and cannot be cancelled.")

    for transaction in db.query(Transaction).filter(
        Transaction.sales_order_id == order.id,
        Transaction.status == "initiated",
    ).all():
        transaction.status = "cancelled"
    order.order_status = "cancelled"
    if order.payment_status in {"pending", "due"}:
        order.payment_status = "cancelled"
    release_order_stock(db, order, current_user.id)
    db.commit()
    return _order_payload(db, order)
