from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Date, ForeignKey, Text
from sqlalchemy.orm import relationship
from backend.database import Base

# Status flow: REQUESTED → SELLER_APPROVED → SCHEDULED → COMPLETED | CANCELLED
INBOUND_STATUSES = ("REQUESTED", "SELLER_APPROVED", "SCHEDULED", "COMPLETED", "CANCELLED")


class Inbound(Base):
    __tablename__ = "inbounds"

    id              = Column(Integer, primary_key=True, index=True)
    product_id      = Column(Integer, ForeignKey("products.id"), nullable=False)
    seller_id       = Column(Integer, ForeignKey("users.id"), nullable=True)
    lot_number      = Column(String, nullable=False)
    expiry_date     = Column(Date, nullable=True)
    quantity        = Column(Integer, nullable=False)
    actual_quantity = Column(Integer, nullable=True)
    inbound_date    = Column(Date, nullable=False)
    completed_date  = Column(Date, nullable=True)
    status          = Column(String, default="REQUESTED", nullable=False)
    note            = Column(Text, nullable=True)
    created_by      = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at      = Column(DateTime, default=datetime.utcnow)

    product  = relationship("Product", back_populates="inbound_records")
    creator  = relationship("User", foreign_keys=[created_by])
    seller   = relationship("User", foreign_keys=[seller_id])
