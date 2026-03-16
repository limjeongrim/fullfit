import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Enum, ForeignKey, Text, Numeric
from sqlalchemy.orm import relationship
from backend.database import Base


class OrderChannel(str, enum.Enum):
    SMARTSTORE = "SMARTSTORE"
    CAFE24 = "CAFE24"
    OLIVEYOUNG = "OLIVEYOUNG"
    ZIGZAG = "ZIGZAG"
    MANUAL = "MANUAL"


class OrderStatus(str, enum.Enum):
    RECEIVED = "RECEIVED"
    PICKING = "PICKING"
    PACKED = "PACKED"
    SHIPPED = "SHIPPED"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"


# Valid forward transitions per status
STATUS_TRANSITIONS: dict[str, list[str]] = {
    OrderStatus.RECEIVED:  [OrderStatus.PICKING,  OrderStatus.CANCELLED],
    OrderStatus.PICKING:   [OrderStatus.PACKED,   OrderStatus.CANCELLED],
    OrderStatus.PACKED:    [OrderStatus.SHIPPED],
    OrderStatus.SHIPPED:   [OrderStatus.DELIVERED],
    OrderStatus.DELIVERED: [],
    OrderStatus.CANCELLED: [],
}


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String, unique=True, index=True, nullable=False)
    channel = Column(Enum(OrderChannel), nullable=False)
    seller_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(Enum(OrderStatus), default=OrderStatus.RECEIVED, nullable=False)
    receiver_name = Column(String, nullable=False)
    receiver_phone = Column(String, nullable=False)
    receiver_address = Column(String, nullable=False)
    total_amount = Column(Numeric(12, 2), nullable=False)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    seller = relationship("User", foreign_keys=[seller_id])
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
