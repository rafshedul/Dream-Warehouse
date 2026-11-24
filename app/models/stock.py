
from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    UniqueConstraint,
)

from app.database import Base


class Stock(Base):
    __tablename__ = "stocks"

    __table_args__ = (
        UniqueConstraint(
            "warehouse_id",
            "product_id",
            name="uq_stock_warehouse_product",
        ),
    )

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    warehouse_id = Column(
        Integer,
        ForeignKey("warehouses.id"),
        nullable=False,
    )

    product_id = Column(
        Integer,
        ForeignKey("products.id"),
        nullable=False,
    )

    quantity = Column(
        Integer,
        nullable=False,
        default=0,
    )

    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )
