
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class Shipment(Base):
    __tablename__ = "shipments"

    id = Column(Integer, primary_key=True, index=True)

    sales_order_id = Column(
        Integer,
        ForeignKey("sales_orders.id"),
        nullable=False,
    )

    warehouse_id = Column(
        Integer,
        ForeignKey("warehouses.id"),
        nullable=False,
    )

    contact_id = Column(
        Integer,
        ForeignKey("contact.id"),
        nullable=False,
    )

    tracking_number = Column(
        String(100),
        unique=True,
        nullable=False,
    )

    date = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    status = Column(
        String(50),
        nullable=False,
        default="pending",
    )

    created_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True,
    )

    creator = relationship("User", foreign_keys=[created_by])
