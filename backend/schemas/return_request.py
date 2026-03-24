from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
from backend.models.return_request import ReturnReason, ReturnStatus


class ReturnCreate(BaseModel):
    order_id: int
    reason: ReturnReason
    note: Optional[str] = None


class ReturnStatusUpdate(BaseModel):
    status: ReturnStatus
    inspection_note: Optional[str] = None


class ReturnItemInfo(BaseModel):
    product_name: str
    sku: str
    quantity: int


class ReturnResponse(BaseModel):
    id: int
    order_id: int
    seller_id: int
    reason: ReturnReason
    status: ReturnStatus
    note: Optional[str]
    inspection_note: Optional[str]
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime]
    order_number: str
    seller_name: str
    items: List[ReturnItemInfo] = []

    class Config:
        from_attributes = True
