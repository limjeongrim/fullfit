import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Enum, ForeignKey
from sqlalchemy.orm import relationship
from backend.models.user import Base


class AdjustmentType(str, enum.Enum):
    ADD = "ADD"
    SUBTRACT = "SUBTRACT"
    SET = "SET"


class InventoryAdjustment(Base):
    __tablename__ = "inventory_adjustments"

    id = Column(Integer, primary_key=True, index=True)
    inventory_id = Column(Integer, ForeignKey("inventory.id"), nullable=False)
    adjusted_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    adjustment_type = Column(Enum(AdjustmentType), nullable=False)
    quantity_before = Column(Integer, nullable=False)
    quantity_after = Column(Integer, nullable=False)
    delta = Column(Integer, nullable=False)  # positive or negative change
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    inventory = relationship("Inventory", backref="adjustments")
    adjuster = relationship("User", foreign_keys=[adjusted_by])
