from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from backend.models.user import Base


class SyncHistory(Base):
    __tablename__ = "sync_histories"

    id = Column(Integer, primary_key=True, index=True)
    channel = Column(String, nullable=False)
    synced_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    order_count = Column(Integer, default=0, nullable=False)
    success = Column(Boolean, default=True, nullable=False)
    error_message = Column(Text, nullable=True)
