from datetime import datetime
from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from backend.database import Base


class ReorderRecommendation(Base):
    __tablename__ = "reorder_recommendations"

    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey("products.id"))
    seller_id = Column(Integer, ForeignKey("users.id"))
    recommended_qty = Column(Integer)   # EOQ
    reorder_point = Column(Integer)     # 재주문점
    current_stock = Column(Integer)
    daily_demand = Column(Float)        # from Moving Average
    lead_time_days = Column(Integer, default=3)
    status = Column(String, default="PENDING")  # PENDING, ORDERED, DISMISSED
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

    product = relationship("Product")
    seller = relationship("User", foreign_keys=[seller_id])
