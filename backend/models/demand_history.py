from datetime import date, datetime
from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from backend.database import Base


class DemandHistory(Base):
    __tablename__ = "demand_history"

    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    date = Column(Date, nullable=False)
    quantity_sold = Column(Integer, nullable=False)
    channel = Column(String)  # SMARTSTORE, CAFE24, OLIVEYOUNG, ZIGZAG
    created_at = Column(DateTime, default=datetime.utcnow)

    product = relationship("Product")
