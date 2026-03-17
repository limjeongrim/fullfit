import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from backend.database import Base


class RoomType(str, enum.Enum):
    ORDER = "ORDER"
    GENERAL = "GENERAL"


class ChatRoom(Base):
    __tablename__ = "chat_rooms"

    id = Column(Integer, primary_key=True, index=True)
    room_type = Column(Enum(RoomType), nullable=False)
    reference_id = Column(String, nullable=True)  # order_number or null
    seller_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    admin_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    last_message = Column(String, nullable=True)
    last_message_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    seller = relationship("User", foreign_keys=[seller_id])
    admin = relationship("User", foreign_keys=[admin_id])
    messages = relationship("ChatMessage", back_populates="room", cascade="all, delete-orphan")
