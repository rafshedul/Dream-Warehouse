
from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    Boolean,
    text,
)
from sqlalchemy.orm import relationship

from app.database import Base


class SalesOrder(Base):
    __tablename__ = "sales_orders"

    id = Column(Integer, primary_key=True, index=True)

    contact_id = Column(
        Integer,
        ForeignKey("contact.id"),
        nullable=False,
    )

    created_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True,
    )

    customer_user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True,
        index=True,
    )

    fulfillment_warehouse_id = Column(
        Integer,
        ForeignKey("warehouses.id"),
        nullable=True,
    )

    total_amount = Column(
        Numeric(12, 2),
        nullable=False,
        default=0,
    )

    shipping_fee = Column(Numeric(12, 2), nullable=False, default=0, server_default=text("0"))
    order_status = Column(String(30), nullable=False, default="processing", server_default=text("'processing'"))
    payment_status = Column(String(30), nullable=False, default="untracked", server_default=text("'untracked'"))
    payment_method = Column(String(30), nullable=True)
    shipping_address = Column(Text, nullable=True)
    shipping_phone = Column(String(50), nullable=True)
    shipping_email = Column(String(255), nullable=True)
    delivery_note = Column(Text, nullable=True)
    stock_released = Column(Boolean, nullable=False, default=False, server_default=text("false"))

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    creator = relationship(
        "User",
        foreign_keys=[created_by],
    )
