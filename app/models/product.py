
from datetime import datetime

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    Numeric,
    ForeignKey,
    text,
    CheckConstraint,
)
from sqlalchemy.orm import relationship

from app.database import Base


class Product(Base):
    __tablename__ = "products"

    __table_args__ = (
        CheckConstraint(
            "reorder_level >= 0",
            name="ck_product_reorder_level_non_negative",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)

    category_id = Column(
        Integer,
        ForeignKey("categories.id"),
        nullable=False
    )

    created_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True
    )

    sku = Column(String(100), unique=True, nullable=False)
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)

    unit_price = Column(Numeric(10, 2), nullable=False)

    reorder_level = Column(
        Integer,
        nullable=False,
        default=10,
        server_default=text("10")
    )

    created_at = Column(DateTime, default=datetime.utcnow)

    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    creator = relationship(
        "User",
        foreign_keys=[created_by]
    )

    category = relationship(
        "Category",
        back_populates="products"
    )
