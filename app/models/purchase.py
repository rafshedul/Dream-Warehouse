
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric

from app.database import Base
from sqlalchemy.orm import relationship


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id = Column(Integer, primary_key=True, index=True)

    supplier_id = Column(
        Integer,
        ForeignKey("suppliers.id"),
        nullable=False,
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    date = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    total_amount = Column(
        Numeric(12, 2),
        nullable=False,
        default=0,
    )
    created_by = Column(
    Integer,
    ForeignKey("users.id"),
    nullable=True,
)

    creator = relationship(
    "User",
    foreign_keys=[created_by],
)
