from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Date, Float, ForeignKey
from sqlalchemy.orm import relationship
from backend.database import Base


class InboundSchedule(Base):
    __tablename__ = "inbound_schedules"

    id              = Column(Integer, primary_key=True, index=True)
    inbound_id      = Column(Integer, ForeignKey("inbounds.id"), nullable=True)
    seller_id       = Column(Integer, ForeignKey("users.id"), nullable=False)
    scheduled_date  = Column(Date, nullable=False)
    time_slot       = Column(String, nullable=False)    # "09:00-10:00" etc
    dock_number     = Column(Integer, default=1)         # 1 or 2
    priority_score  = Column(Float, default=0.0)
    priority_reason = Column(String, nullable=True)
    status          = Column(String, default="SCHEDULED")  # SCHEDULED, CONFIRMED, COMPLETED, CANCELLED
    created_at      = Column(DateTime, default=datetime.utcnow)

    inbound = relationship("Inbound", foreign_keys=[inbound_id])
    seller  = relationship("User",    foreign_keys=[seller_id])
