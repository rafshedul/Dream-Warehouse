
from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.database import Base


class Transaction(Base):
    __tablename__ = "transactions"

    __table_args__ = (
        UniqueConstraint("gateway_tran_id", name="uq_transactions_gateway_tran_id"),
    )

    id = Column(Integer, primary_key=True, index=True)

    contact_id = Column(
        Integer,
        ForeignKey("contact.id"),
        nullable=False,
    )

    sales_order_id = Column(
        Integer,
        ForeignKey("sales_orders.id"),
        nullable=False,
    )

    amount = Column(Numeric(12, 2), nullable=False)

    date = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    status = Column(
        String(50),
        default="pending",
        nullable=False,
    )

    gateway_tran_id = Column(String(30), nullable=True)
    validation_id = Column(String(80), nullable=True)

    created_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True,
    )

    creator = relationship(
        "User",
        foreign_keys=[created_by],
    )
