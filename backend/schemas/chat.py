from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from enum import Enum


class RoomType(str, Enum):
    ORDER = "ORDER"
    GENERAL = "GENERAL"


class ChatRoomCreate(BaseModel):
    room_type: RoomType
    reference_id: Optional[str] = None


class ChatRoomResponse(BaseModel):
    id: int
    room_type: RoomType
    reference_id: Optional[str]
    seller_id: int
    seller_name: str
    admin_id: Optional[int]
    last_message: Optional[str]
    last_message_at: Optional[datetime]
    created_at: datetime
    unread_count: int

    class Config:
        from_attributes = True


class ChatMessageCreate(BaseModel):
    message: str


class ChatMessageResponse(BaseModel):
    id: int
    room_id: int
    sender_id: int
    sender_name: str
    sender_role: str
    message: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True
