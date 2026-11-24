from collections import Counter
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.models.sales_order import SalesOrder
from app.models.sales_order_item import SalesOrderItem
from app.models.stock import Stock
from app.models.stock_activity import StockActivity
from app.models.transaction import Transaction


def release_order_stock(db: Session, order: SalesOrder, actor_user_id: int | None) -> None:
    """Release inventory reserved by an order once, with a matching stock history entry."""
    if order.stock_released or not order.fulfillment_warehouse_id:
        return

    for line in db.query(SalesOrderItem).filter(
        SalesOrderItem.sales_order_id == order.id
    ).all():
        stock = (
            db.query(Stock)
            .filter(
                Stock.warehouse_id == order.fulfillment_warehouse_id,
                Stock.product_id == line.product_id,
            )
            .with_for_update()
            .first()
        )
        if stock is None:
            continue
        stock.quantity += line.quantity
        db.add(StockActivity(
            product_id=line.product_id,
            warehouse_id=order.fulfillment_warehouse_id,
            quantity=line.quantity,
            movement_type="IN",
            created_by=actor_user_id,
        ))
    order.stock_released = True


def reserve_order_stock(db: Session, order: SalesOrder, actor_user_id: int | None) -> bool:
    """Re-reserve stock for an order whose stock was released (e.g. a payment that
    arrived after the order was cancelled). Returns False, changing nothing, when the
    warehouse no longer has enough stock."""
    if not order.stock_released:
        return True
    if not order.fulfillment_warehouse_id:
        return False

    needed = Counter()
    for line in db.query(SalesOrderItem).filter(
        SalesOrderItem.sales_order_id == order.id
    ).all():
        needed[line.product_id] += line.quantity

    stocks: dict[int, Stock] = {}
    for product_id, quantity in needed.items():
        stock = (
            db.query(Stock)
            .filter(
                Stock.warehouse_id == order.fulfillment_warehouse_id,
                Stock.product_id == product_id,
            )
            .with_for_update()
            .first()
        )
        if stock is None or stock.quantity < quantity:
            return False
        stocks[product_id] = stock

    for product_id, quantity in needed.items():
        stocks[product_id].quantity -= quantity
        db.add(StockActivity(
            product_id=product_id,
            warehouse_id=order.fulfillment_warehouse_id,
            quantity=quantity,
            movement_type="OUT",
            created_by=actor_user_id,
        ))
    order.stock_released = False
    return True


def expire_unpaid_online_orders(db: Session, max_age_minutes: int) -> int:
    """Cancel online-payment orders that were never paid and give their stock back."""
    cutoff = datetime.utcnow() - timedelta(minutes=max_age_minutes)
    orders = (
        db.query(SalesOrder)
        .filter(
            SalesOrder.payment_method == "sslcommerz",
            SalesOrder.payment_status == "pending",
            SalesOrder.order_status == "processing",
            SalesOrder.customer_user_id.isnot(None),
            SalesOrder.created_at < cutoff,
        )
        .with_for_update()
        .all()
    )
    for order in orders:
        for transaction in db.query(Transaction).filter(
            Transaction.sales_order_id == order.id,
            Transaction.status == "initiated",
        ).all():
            transaction.status = "expired"
        order.payment_status = "expired"
        order.order_status = "cancelled"
        release_order_stock(db, order, order.created_by)
    if orders:
        db.commit()
    return len(orders)
