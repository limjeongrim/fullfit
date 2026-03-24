from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from backend.database import Base


class OrderIssue(Base):
    __tablename__ = "order_issues"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    seller_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    issue_type = Column(String, nullable=False)
    priority = Column(String, default="NORMAL")    # CRITICAL / HIGH / NORMAL
    status = Column(String, default="OPEN")        # OPEN / IN_PROGRESS / RESOLVED / CLOSED
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    assigned_to = Column(String, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    resolution_note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("Order", foreign_keys=[order_id])
    seller = relationship("User", foreign_keys=[seller_id])
