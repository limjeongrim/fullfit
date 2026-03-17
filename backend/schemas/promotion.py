from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel
from backend.models.promotion import PromotionChannel


class PromotionCreate(BaseModel):
    name: str
    channel: PromotionChannel
    start_date: date
    end_date: date
    expected_order_multiplier: float = 1.0
    note: Optional[str] = None


class PromotionResponse(BaseModel):
    id: int
    name: str
    channel: PromotionChannel
    start_date: date
    end_date: date
    expected_order_multiplier: float
    note: Optional[str]
    created_at: datetime
    days_until_start: int
    is_active: bool

    class Config:
        from_attributes = True
