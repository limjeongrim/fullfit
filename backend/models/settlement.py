import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Enum, ForeignKey, Numeric
from sqlalchemy.orm import relationship
from backend.database import Base


class SettlementStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    CONFIRMED = "CONFIRMED"


class Settlement(Base):
    __tablename__ = "settlements"

    id = Column(Integer, primary_key=True, index=True)
    seller_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    year_month = Column(String(7), nullable=False)       # e.g. "2026-03"
    storage_fee = Column(Numeric(12, 2), default=0)
    inbound_fee = Column(Numeric(12, 2), default=0)
    outbound_fee = Column(Numeric(12, 2), default=0)
    extra_fee = Column(Numeric(12, 2), default=0)
    total_fee = Column(Numeric(12, 2), default=0)
    status = Column(Enum(SettlementStatus), default=SettlementStatus.DRAFT, nullable=False)
    confirmed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    seller = relationship("User", foreign_keys=[seller_id])
