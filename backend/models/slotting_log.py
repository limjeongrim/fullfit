from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Float, ForeignKey
from sqlalchemy.orm import relationship
from backend.database import Base


class SlottingLog(Base):
    __tablename__ = "slotting_logs"

    id            = Column(Integer, primary_key=True, index=True)
    product_id    = Column(Integer, ForeignKey("products.id"), nullable=False)
    from_location = Column(String, nullable=True)
    to_location   = Column(String, nullable=False)
    abc_class     = Column(String, nullable=True)      # A, B, C
    turnover_rate = Column(Float,  nullable=True)
    changed_by    = Column(Integer, ForeignKey("users.id"), nullable=True)
    changed_at    = Column(DateTime, default=datetime.utcnow)
    reason        = Column(String, nullable=True)

    product        = relationship("Product", foreign_keys=[product_id])
    changed_by_user = relationship("User",  foreign_keys=[changed_by])
