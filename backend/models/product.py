import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum, ForeignKey
from sqlalchemy.orm import relationship
from backend.database import Base


class StorageType(str, enum.Enum):
    ROOM_TEMP = "ROOM_TEMP"
    COLD = "COLD"


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    seller_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    sku = Column(String, unique=True, index=True, nullable=False)
    barcode = Column(String, nullable=True)
    category = Column(String, nullable=True)
    storage_type    = Column(Enum(StorageType), default=StorageType.ROOM_TEMP, nullable=False)
    warehouse_zone  = Column(String, default="B")   # A, B, C, D
    warehouse_row   = Column(Integer, default=1)     # 1-10
    warehouse_col   = Column(Integer, default=1)     # 1-5
    location_code   = Column(String, nullable=True)  # e.g. "A-03-02"
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    seller = relationship("User", foreign_keys=[seller_id])
    inventory_lots = relationship("Inventory", back_populates="product", cascade="all, delete-orphan")
    inbound_records = relationship("Inbound", back_populates="product")
