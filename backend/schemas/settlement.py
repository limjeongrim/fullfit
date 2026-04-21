from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from decimal import Decimal
from backend.models.settlement import SettlementStatus


class SettlementGenerate(BaseModel):
    seller_id: int
    year_month: str          # "2026-03"


class SettlementResponse(BaseModel):
    id: int
    seller_id: int
    seller_name: str
    year_month: str
    total_sales: Decimal = Decimal(0)
    channel_fee: Decimal = Decimal(0)
    storage_fee: Decimal
    outbound_fee: Decimal
    extra_fee: Decimal
    inbound_fee: Decimal
    total_fee: Decimal
    order_count: int = 0
    return_count: int = 0
    status: SettlementStatus
    confirmed_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True
