
from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    CheckConstraint,
)

from sqlalchemy.orm import relationship

from app.database import Base


class StockAdjustmentRequest(Base):
    __tablename__ = "stock_adjustment_requests"

    __table_args__ = (
        CheckConstraint(
            "current_quantity >= 0",
            name="ck_adjustment_current_quantity_non_negative",
        ),
        CheckConstraint(
            "counted_quantity >= 0",
            name="ck_adjustment_counted_quantity_non_negative",
        ),
        CheckConstraint(
            "difference != 0",
            name="ck_adjustment_difference_non_zero",
        ),
        CheckConstraint(
            "difference = counted_quantity - current_quantity",
            name="ck_adjustment_difference_correct",
        ),
    )

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

    current_quantity = Column(
        Integer,
        nullable=False,
    )

    counted_quantity = Column(
        Integer,
        nullable=False,
    )

    difference = Column(
        Integer,
        nullable=False,
    )

    reason = Column(
        Text,
        nullable=False,
    )

    status = Column(
        String(20),
        nullable=False,
        default="pending",
    )

    requested_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
    )

    reviewed_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True,
    )

    review_note = Column(
        Text,
        nullable=True,
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    reviewed_at = Column(
        DateTime,
        nullable=True,
    )

    product = relationship("Product")
    warehouse = relationship("Warehouse")

    requester = relationship(
        "User",
        foreign_keys=[requested_by],
    )

    reviewer = relationship(
        "User",
        foreign_keys=[reviewed_by],
    )
