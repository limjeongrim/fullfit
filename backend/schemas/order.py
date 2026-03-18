from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from decimal import Decimal
from backend.models.order import OrderChannel, OrderStatus


class OrderItemCreate(BaseModel):
    product_id: int
    quantity: int
    unit_price: Decimal


class OrderItemResponse(BaseModel):
    id: int
    product_id: int
    product_name: str
    storage_type: str
    quantity: int
    unit_price: Decimal

    class Config:
        from_attributes = True


class OrderCreate(BaseModel):
    channel: OrderChannel
    receiver_name: str
    receiver_phone: str
    receiver_address: str
    total_amount: Decimal
    note: Optional[str] = None
    items: List[OrderItemCreate] = []


class OrderStatusUpdate(BaseModel):
    status: OrderStatus


class OrderResponse(BaseModel):
    id: int
    order_number: str
    channel: OrderChannel
    seller_id: int
    seller_name: str
    status: OrderStatus
    receiver_name: str
    receiver_phone: str
    receiver_address: str
    total_amount: Decimal
    note: Optional[str]
    items: List[OrderItemResponse]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OrderListItem(BaseModel):
    id: int
    order_number: str
    channel: OrderChannel
    seller_id: int
    seller_name: str
    status: OrderStatus
    receiver_name: str
    receiver_address: str
    total_amount: Decimal
    items: List[OrderItemResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True


class OrderListResponse(BaseModel):
    total: int
    items: List[OrderListItem]
