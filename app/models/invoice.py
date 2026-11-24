from sqlalchemy import Column, ForeignKey, Integer
from app.database import Base

class Invoice(Base):
    __tablename__ = "invoices"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
    )
    sales_order_id = Column(
        Integer,
        ForeignKey("sales_orders.id"),
        nullable=False,
    )
    transaction_id = Column(
        Integer,
        ForeignKey("transactions.id"),
        nullable=False,
    )
