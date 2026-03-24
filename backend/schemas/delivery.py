from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime
from backend.models.delivery import Carrier, DeliveryStatus


class DeliveryCreate(BaseModel):
    order_id: int
    tracking_number: str
    carrier: Carrier
    estimated_delivery: Optional[date] = None
    note: Optional[str] = None


class DeliveryStatusUpdate(BaseModel):
    status: DeliveryStatus
    note: Optional[str] = None


class DeliveryResponse(BaseModel):
    id: int
    order_id: int
    order_number: str
    receiver_name: str
    receiver_address: str
    tracking_number: str
    carrier: Carrier
    status: DeliveryStatus
    estimated_delivery: Optional[date]
    actual_delivery: Optional[date]
    note: Optional[str]
    delivery_lat: Optional[float] = None
    delivery_lng: Optional[float] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
