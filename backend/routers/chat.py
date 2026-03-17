from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.core.dependencies import get_current_user
from backend.models.user import User, UserRole
from backend.models.chat_room import ChatRoom, RoomType
from backend.models.chat_message import ChatMessage
from backend.schemas.chat import (
    ChatRoomCreate, ChatRoomResponse,
    ChatMessageCreate, ChatMessageResponse,
)

router = APIRouter(prefix="/chat", tags=["Chat"])


def _room_to_response(room: ChatRoom, current_user_id: int, db: Session) -> ChatRoomResponse:
    unread = db.query(ChatMessage).filter(
        ChatMessage.room_id == room.id,
        ChatMessage.sender_id != current_user_id,
        ChatMessage.is_read == False,  # noqa: E712
    ).count()
    return ChatRoomResponse(
        id=room.id,
        room_type=room.room_type,
        reference_id=room.reference_id,
        seller_id=room.seller_id,
        seller_name=room.seller.full_name if room.seller else "—",
        admin_id=room.admin_id,
        last_message=room.last_message,
        last_message_at=room.last_message_at,
        created_at=room.created_at,
        unread_count=unread,
    )


@router.get("/rooms", response_model=List[ChatRoomResponse])
def list_rooms(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role == UserRole.ADMIN:
        rooms = (
            db.query(ChatRoom)
            .order_by(ChatRoom.last_message_at.desc().nullslast())
            .all()
        )
    else:
        rooms = (
            db.query(ChatRoom)
            .filter(ChatRoom.seller_id == current_user.id)
            .order_by(ChatRoom.last_message_at.desc().nullslast())
            .all()
        )
    return [_room_to_response(r, current_user.id, db) for r in rooms]


@router.post("/rooms", response_model=ChatRoomResponse)
def create_room(
    body: ChatRoomCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != UserRole.SELLER:
        raise HTTPException(status_code=403, detail="셀러만 채팅방을 생성할 수 있습니다.")
    room = ChatRoom(
        room_type=body.room_type,
        reference_id=body.reference_id,
        seller_id=current_user.id,
    )
    db.add(room)
    db.commit()
    db.refresh(room)
    return _room_to_response(room, current_user.id, db)


@router.get("/rooms/{room_id}/messages", response_model=List[ChatMessageResponse])
def list_messages(
    room_id: int,
    page: int = 1,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    room = db.query(ChatRoom).filter(ChatRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="채팅방을 찾을 수 없습니다.")
    if current_user.role != UserRole.ADMIN and room.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다.")
    offset = (page - 1) * 50
    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.room_id == room_id)
        .order_by(ChatMessage.created_at.asc())
        .offset(offset)
        .limit(50)
        .all()
    )
    return [
        ChatMessageResponse(
            id=m.id,
            room_id=m.room_id,
            sender_id=m.sender_id,
            sender_name=m.sender.full_name if m.sender else "—",
            sender_role=m.sender.role.value if m.sender else "UNKNOWN",
            message=m.message,
            is_read=m.is_read,
            created_at=m.created_at,
        )
        for m in messages
    ]


@router.post("/rooms/{room_id}/messages", response_model=ChatMessageResponse)
def send_message(
    room_id: int,
    body: ChatMessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    room = db.query(ChatRoom).filter(ChatRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="채팅방을 찾을 수 없습니다.")
    if current_user.role != UserRole.ADMIN and room.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다.")
    now = datetime.utcnow()
    msg = ChatMessage(
        room_id=room_id,
        sender_id=current_user.id,
        message=body.message,
        created_at=now,
    )
    db.add(msg)
    room.last_message = body.message
    room.last_message_at = now
    if current_user.role == UserRole.ADMIN and not room.admin_id:
        room.admin_id = current_user.id
    db.commit()
    db.refresh(msg)
    return ChatMessageResponse(
        id=msg.id,
        room_id=msg.room_id,
        sender_id=msg.sender_id,
        sender_name=current_user.full_name,
        sender_role=current_user.role.value,
        message=msg.message,
        is_read=msg.is_read,
        created_at=msg.created_at,
    )


@router.patch("/rooms/{room_id}/read")
def mark_read(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    room = db.query(ChatRoom).filter(ChatRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="채팅방을 찾을 수 없습니다.")
    if current_user.role != UserRole.ADMIN and room.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다.")
    db.query(ChatMessage).filter(
        ChatMessage.room_id == room_id,
        ChatMessage.sender_id != current_user.id,
        ChatMessage.is_read == False,  # noqa: E712
    ).update({"is_read": True})
    db.commit()
    return {"ok": True}


@router.get("/unread-count")
def unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role == UserRole.ADMIN:
        rooms = db.query(ChatRoom).all()
    else:
        rooms = db.query(ChatRoom).filter(ChatRoom.seller_id == current_user.id).all()
    room_ids = [r.id for r in rooms]
    if not room_ids:
        return {"count": 0}
    count = db.query(ChatMessage).filter(
        ChatMessage.room_id.in_(room_ids),
        ChatMessage.sender_id != current_user.id,
        ChatMessage.is_read == False,  # noqa: E712
    ).count()
    return {"count": count}
