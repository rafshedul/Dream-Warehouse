
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from datetime import datetime
from sqlalchemy.orm import relationship

from app.database import Base
from app.core.roles import UserRole


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    password = Column(String, nullable=False)

    role = Column(
        String,
        nullable=False,
        default=UserRole.USER.value
    )

    email = Column(String, unique=True, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    contact_id = Column(
        Integer,
        ForeignKey("contact.id"),
        nullable=False
    )
    contact = relationship("Contact")