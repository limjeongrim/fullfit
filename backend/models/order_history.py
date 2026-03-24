from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from backend.database import Base


class OrderHistory(Base):
    __tablename__ = "order_histories"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    changed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    changed_by_name = Column(String, nullable=False)   # "김철수 (관리자)" / "자동 시뮬레이터"
    field_changed = Column(String, nullable=False)      # "status"
    old_value = Column(String, nullable=True)
    new_value = Column(String, nullable=False)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
