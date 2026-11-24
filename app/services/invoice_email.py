import html as html_lib
import logging
import os
import smtplib
from email.message import EmailMessage
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.invoice import Invoice
from app.models.sales_order import SalesOrder
from app.models.sales_order_item import SalesOrderItem
from app.models.product import Product

logger = logging.getLogger(__name__)


def email_paid_order_invoice(db: Session, order: SalesOrder, invoice: Invoice) -> bool:
    host = os.getenv("SMTP_HOST", "").strip()
    recipient = (order.shipping_email or "").strip()
    sender = os.getenv("SMTP_FROM", "").strip()
    if not host or not sender or not recipient:
        logger.info("Invoice email not sent: SMTP or customer email is not configured (order %s)", order.id)
        return False

    port = int(os.getenv("SMTP_PORT", "587"))
    message = EmailMessage()
    message["Subject"] = f"Dream Warehouse invoice INV-{invoice.id:06d}"
    message["From"] = sender
    message["To"] = recipient
    lines = db.query(SalesOrderItem, Product).join(
        Product, Product.id == SalesOrderItem.product_id
    ).filter(SalesOrderItem.sales_order_id == order.id).all()
    rows = "".join(
        f"<tr><td>{html_lib.escape(product.name)}</td><td>{line.quantity}</td><td>৳ {line.unit_price:.2f}</td><td>৳ {line.total_price:.2f}</td></tr>"
        for line, product in lines
    )
    html = (
        "<h2>Dream Warehouse invoice</h2>"
        f"<p>Invoice INV-{invoice.id:06d} · Order #{order.id} · Paid</p>"
        "<table border='1' cellpadding='6' cellspacing='0'><thead><tr><th>Product</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead>"
        f"<tbody>{rows}</tbody></table>"
        f"<p>Items: ৳ {Decimal(order.total_amount) - Decimal(order.shipping_fee):.2f}<br>"
        f"Delivery: ৳ {Decimal(order.shipping_fee):.2f}<br><strong>Paid: ৳ {Decimal(order.total_amount):.2f}</strong></p>"
        f"<p>Deliver to: {html_lib.escape(order.shipping_address or '')}</p>"
    )
    message.set_content(
        f"Invoice INV-{invoice.id:06d} for order #{order.id}. Paid amount: ৳ {order.total_amount:.2f}."
    )
    message.add_alternative(html, subtype="html")
    username = os.getenv("SMTP_USERNAME", "").strip()
    password = os.getenv("SMTP_PASSWORD", "")
    try:
        with smtplib.SMTP(host, port, timeout=15) as smtp:
            if os.getenv("SMTP_STARTTLS", "true").lower() == "true":
                smtp.starttls()
            if username:
                smtp.login(username, password)
            smtp.send_message(message)
        return True
    except Exception:
        logger.exception("Could not send invoice email for order %s", order.id)
        return False
