import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Date, Enum, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from backend.database import Base


class Carrier(str, enum.Enum):
    CJ = "CJ"
    HANJIN = "HANJIN"
    LOTTE = "LOTTE"
    ETC = "ETC"


class DeliveryStatus(str, enum.Enum):
    READY = "READY"
    IN_TRANSIT = "IN_TRANSIT"
    OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY"
    DELIVERED = "DELIVERED"
    FAILED = "FAILED"


class Delivery(Base):
    __tablename__ = "deliveries"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False, unique=True)
    tracking_number = Column(String, nullable=False, index=True)
    carrier = Column(Enum(Carrier), nullable=False)
    status = Column(Enum(DeliveryStatus), default=DeliveryStatus.READY, nullable=False)
    estimated_delivery = Column(Date, nullable=True)
    actual_delivery = Column(Date, nullable=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    order = relationship("Order", foreign_keys=[order_id])
