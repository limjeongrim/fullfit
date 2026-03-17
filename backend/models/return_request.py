import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Enum, ForeignKey, Text, DateTime
from sqlalchemy.orm import relationship
from backend.models.user import Base


class ReturnReason(str, enum.Enum):
    DEFECTIVE = "DEFECTIVE"
    WRONG_ITEM = "WRONG_ITEM"
    CHANGE_OF_MIND = "CHANGE_OF_MIND"
    OTHER = "OTHER"


class ReturnStatus(str, enum.Enum):
    REQUESTED = "REQUESTED"
    IN_REVIEW = "IN_REVIEW"
    RESTOCKED = "RESTOCKED"
    DISPOSED = "DISPOSED"


class ReturnRequest(Base):
    __tablename__ = "return_requests"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    seller_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    reason = Column(Enum(ReturnReason), nullable=False)
    status = Column(Enum(ReturnStatus), default=ReturnStatus.REQUESTED, nullable=False)
    note = Column(Text, nullable=True)
    inspection_note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    resolved_at = Column(DateTime, nullable=True)

    order = relationship("Order", backref="return_requests")
    seller = relationship("User", backref="return_requests")
