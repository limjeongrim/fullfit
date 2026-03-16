from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Date, ForeignKey
from sqlalchemy.orm import relationship
from backend.database import Base


class Inventory(Base):
    __tablename__ = "inventory"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    lot_number = Column(String, nullable=False)
    expiry_date = Column(Date, nullable=False)
    quantity = Column(Integer, default=0)
    location = Column(String, nullable=True)
    inbound_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    product = relationship("Product", back_populates="inventory_lots")
