from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Date, ForeignKey, Text
from sqlalchemy.orm import relationship
from backend.database import Base


class Inbound(Base):
    __tablename__ = "inbounds"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    lot_number = Column(String, nullable=False)
    expiry_date = Column(Date, nullable=False)
    quantity = Column(Integer, nullable=False)
    inbound_date = Column(Date, nullable=False)
    note = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    product = relationship("Product", back_populates="inbound_records")
    creator = relationship("User", foreign_keys=[created_by])
