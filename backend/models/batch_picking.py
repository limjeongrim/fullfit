import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from backend.database import Base


class BatchStatus(str, enum.Enum):
    CREATED     = "CREATED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED   = "COMPLETED"


class BatchPicking(Base):
    __tablename__ = "batch_pickings"

    id                 = Column(Integer, primary_key=True, index=True)
    batch_number       = Column(String, unique=True, nullable=False, index=True)
    status             = Column(String, default="CREATED", nullable=False)
    order_ids          = Column(String, nullable=False)   # JSON array of int
    total_items        = Column(Integer, nullable=False, default=0)
    assigned_worker_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at         = Column(DateTime, default=datetime.utcnow)
    completed_at       = Column(DateTime, nullable=True)

    assigned_worker = relationship("User", foreign_keys=[assigned_worker_id])
