
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class StockActivity(Base):
    __tablename__ = "stock_activities"

    id = Column(Integer, primary_key=True, index=True)

    product_id = Column(
        Integer,
        ForeignKey("products.id"),
        nullable=False,
    )

    warehouse_id = Column(
        Integer,
        ForeignKey("warehouses.id"),
        nullable=False,
    )

    quantity = Column(
        Integer,
        nullable=False,
    )

    date = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    movement_type = Column(
        String(50),
        nullable=False,
    )

    created_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True,
    )

    creator = relationship("User", foreign_keys=[created_by])
    product = relationship("Product", foreign_keys=[product_id])
