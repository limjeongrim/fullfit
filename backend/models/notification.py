import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, Enum, ForeignKey
from sqlalchemy.orm import relationship
from backend.models.user import Base


class NotificationType(str, enum.Enum):
    ORDER_RECEIVED = "ORDER_RECEIVED"
    STOCK_LOW = "STOCK_LOW"
    EXPIRY_ALERT = "EXPIRY_ALERT"
    DELIVERY_UPDATE = "DELIVERY_UPDATE"
    SETTLEMENT_READY = "SETTLEMENT_READY"
    PROMOTION_ALERT = "PROMOTION_ALERT"
    INBOUND_SCHEDULED = "INBOUND_SCHEDULED"
    RETURN_PROCESSED = "RETURN_PROCESSED"
    ORDER_DELAYED = "ORDER_DELAYED"
    ISSUE_CREATED = "ISSUE_CREATED"
    RESTOCK_REQUESTED = "RESTOCK_REQUESTED"


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    type = Column(Enum(NotificationType), nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", backref="notifications")
