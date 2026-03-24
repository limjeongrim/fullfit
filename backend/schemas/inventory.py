from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime
from backend.models.product import StorageType


class ProductCreate(BaseModel):
    name: str
    sku: str
    barcode: Optional[str] = None
    category: Optional[str] = None
    storage_type: StorageType = StorageType.ROOM_TEMP
    seller_id: int


class ProductResponse(BaseModel):
    id: int
    seller_id: int
    name: str
    sku: str
    barcode: Optional[str]
    category: Optional[str]
    storage_type: StorageType
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class InboundCreate(BaseModel):
    product_id: int
    lot_number: str
    expiry_date: date
    quantity: int
    note: Optional[str] = None


class InboundResponse(BaseModel):
    id: int
    product_id: int
    product_name: str
    lot_number: str
    expiry_date: date
    quantity: int
    inbound_date: date
    note: Optional[str]
    created_by: int
    created_at: datetime

    class Config:
        from_attributes = True


class InventoryResponse(BaseModel):
    id: int
    product_id: int
    product_name: str
    sku: str
    storage_type: StorageType
    warehouse_zone: Optional[str]
    lot_number: str
    expiry_date: date
    quantity: int
    location: Optional[str]
    inbound_date: Optional[date]
    days_until_expiry: int
    allocated_stock: int = 0
    pending_inbound: int = 0

    class Config:
        from_attributes = True
