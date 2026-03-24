import csv
import io
from datetime import datetime
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from backend.database import get_db
from backend.models.user import User, UserRole
from backend.models.order import Order, OrderChannel, OrderStatus, STATUS_TRANSITIONS
from backend.models.order_item import OrderItem
from backend.models.order_history import OrderHistory
from backend.models.product import Product
from backend.schemas.order import (
    OrderCreate, OrderResponse, OrderListResponse, OrderListItem,
    OrderStatusUpdate, OrderItemResponse,
)
from backend.core.dependencies import get_current_user, require_role
from backend.core.notify import create_notification
from backend.models.notification import NotificationType

router = APIRouter()

STATUS_LABELS_KR = {
    "RECEIVED":  "주문 접수",
    "PICKING":   "출고 준비중",
    "PACKED":    "패킹 완료",
    "SHIPPED":   "출고 완료",
    "DELIVERED": "배송 완료",
    "CANCELLED": "취소",
}
ROLE_LABELS_KR = {
    "ADMIN":  "관리자",
    "WORKER": "작업자",
    "SELLER": "셀러",
}


# ── Helpers ────────────────────────────────────────────────────────────────────

def _generate_order_number(db: Session) -> str:
    today = datetime.now().strftime("%Y%m%d")
    prefix = f"FF-{today}-"
    last = (
        db.query(Order)
        .filter(Order.order_number.like(f"{prefix}%"))
        .order_by(Order.order_number.desc())
        .first()
    )
    seq = (int(last.order_number.rsplit("-", 1)[-1]) + 1) if last else 1
    return f"{prefix}{seq:04d}"


def _order_to_response(order: Order) -> OrderResponse:
    return OrderResponse(
        id=order.id,
        order_number=order.order_number,
        channel=order.channel,
        seller_id=order.seller_id,
        seller_name=order.seller.full_name,
        status=order.status,
        receiver_name=order.receiver_name,
        receiver_phone=order.receiver_phone,
        receiver_address=order.receiver_address,
        total_amount=order.total_amount,
        note=order.note,
        items=[
            OrderItemResponse(
                id=it.id,
                product_id=it.product_id,
                product_name=it.product.name,
                storage_type=it.product.storage_type,
                quantity=it.quantity,
                unit_price=it.unit_price,
                location_code=it.product.location_code,
            )
            for it in order.items
        ],
        created_at=order.created_at,
        updated_at=order.updated_at,
        tracking_number=order.delivery.tracking_number if order.delivery else None,
        carrier=order.delivery.carrier.value if order.delivery else None,
    )


def _order_to_list_item(order: Order) -> OrderListItem:
    return OrderListItem(
        id=order.id,
        order_number=order.order_number,
        channel=order.channel,
        seller_id=order.seller_id,
        seller_name=order.seller.full_name,
        status=order.status,
        receiver_name=order.receiver_name,
        receiver_address=order.receiver_address,
        total_amount=order.total_amount,
        items=[
            OrderItemResponse(
                id=it.id,
                product_id=it.product_id,
                product_name=it.product.name,
                storage_type=it.product.storage_type,
                quantity=it.quantity,
                unit_price=it.unit_price,
                location_code=it.product.location_code,
            )
            for it in order.items
        ],
        created_at=order.created_at,
    )


def _build_order(db: Session, data: OrderCreate, seller_id: int) -> Order:
    order = Order(
        order_number=_generate_order_number(db),
        channel=data.channel,
        seller_id=seller_id,
        status=OrderStatus.RECEIVED,
        receiver_name=data.receiver_name,
        receiver_phone=data.receiver_phone,
        receiver_address=data.receiver_address,
        total_amount=data.total_amount,
        note=data.note,
    )
    db.add(order)
    db.flush()
    for it in data.items:
        db.add(OrderItem(
            order_id=order.id,
            product_id=it.product_id,
            quantity=it.quantity,
            unit_price=it.unit_price,
        ))
    return order


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/orders/", response_model=OrderListResponse)
def list_orders(
    status: Optional[OrderStatus] = Query(None),
    channel: Optional[OrderChannel] = Query(None),
    search: Optional[str] = Query(None),
    seller_id: Optional[int] = Query(None),
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.WORKER])),
):
    q = db.query(Order).options(joinedload(Order.seller), joinedload(Order.items).joinedload(OrderItem.product))
    if status:
        q = q.filter(Order.status == status)
    if channel:
        q = q.filter(Order.channel == channel)
    if search:
        q = q.filter(
            Order.order_number.ilike(f"%{search}%") |
            Order.receiver_name.ilike(f"%{search}%")
        )
    if seller_id:
        q = q.filter(Order.seller_id == seller_id)
    total = q.count()
    orders = q.order_by(Order.created_at.desc()).offset(skip).limit(limit).all()
    return OrderListResponse(total=total, items=[_order_to_list_item(o) for o in orders])


@router.get("/orders/seller", response_model=OrderListResponse)
def list_orders_seller(
    status: Optional[OrderStatus] = Query(None),
    channel: Optional[OrderChannel] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.SELLER])),
):
    q = (
        db.query(Order)
        .options(joinedload(Order.seller), joinedload(Order.items).joinedload(OrderItem.product))
        .filter(Order.seller_id == current_user.id)
    )
    if status:
        q = q.filter(Order.status == status)
    if channel:
        q = q.filter(Order.channel == channel)
    if search:
        q = q.filter(
            Order.order_number.ilike(f"%{search}%") |
            Order.receiver_name.ilike(f"%{search}%")
        )
    total = q.count()
    orders = q.order_by(Order.created_at.desc()).offset(skip).limit(limit).all()
    return OrderListResponse(total=total, items=[_order_to_list_item(o) for o in orders])


@router.post("/orders/upload", response_model=dict)
async def upload_orders_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN])),
):
    content = await file.read()
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    required_cols = {"channel", "receiver_name", "receiver_phone", "receiver_address", "total_amount", "seller_id"}
    created = 0
    errors = []

    for i, row in enumerate(reader, start=2):
        missing = required_cols - set(row.keys())
        if missing:
            errors.append(f"행 {i}: 필수 컬럼 누락 {missing}")
            continue
        try:
            channel = OrderChannel(row["channel"].strip().upper())
        except ValueError:
            errors.append(f"행 {i}: 잘못된 채널 값 '{row['channel']}'")
            continue
        try:
            seller_id = int(row["seller_id"])
        except ValueError:
            errors.append(f"행 {i}: seller_id가 숫자가 아닙니다")
            continue

        data = OrderCreate(
            channel=channel,
            receiver_name=row["receiver_name"].strip(),
            receiver_phone=row["receiver_phone"].strip(),
            receiver_address=row["receiver_address"].strip(),
            total_amount=Decimal(row["total_amount"].strip()),
            note=row.get("note", "").strip() or None,
            items=[],
        )
        _build_order(db, data, seller_id)
        created += 1

    db.commit()
    return {"created": created, "errors": errors}


@router.get("/orders/{order_id}/history")
def get_order_history(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="주문을 찾을 수 없습니다.")
    if current_user.role == UserRole.SELLER and order.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다.")

    histories = (
        db.query(OrderHistory)
        .filter(OrderHistory.order_id == order_id)
        .order_by(OrderHistory.created_at.desc())
        .all()
    )
    return [
        {
            "id": h.id,
            "changed_by_name": h.changed_by_name,
            "field_changed": h.field_changed,
            "old_value": h.old_value,
            "new_value": h.new_value,
            "note": h.note,
            "created_at": h.created_at.isoformat() if h.created_at else None,
        }
        for h in histories
    ]


@router.get("/orders/{order_id}", response_model=OrderResponse)
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = (
        db.query(Order)
        .options(joinedload(Order.seller), joinedload(Order.items).joinedload(OrderItem.product))
        .filter(Order.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="주문을 찾을 수 없습니다.")
    if current_user.role == UserRole.SELLER and order.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다.")
    if current_user.role == UserRole.WORKER:
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다.")
    return _order_to_response(order)


@router.post("/orders/", response_model=OrderResponse)
def create_order(
    data: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.SELLER])),
):
    if current_user.role == UserRole.SELLER:
        seller_id = current_user.id
    else:
        seller_id = current_user.id

    order = _build_order(db, data, seller_id)
    db.flush()
    admins = db.query(User).filter(User.role == UserRole.ADMIN).all()
    for admin in admins:
        create_notification(
            db, admin.id, NotificationType.ORDER_RECEIVED,
            "새 주문 접수",
            f"주문번호 {order.order_number} ({data.channel.value}) 접수되었습니다.",
        )
    db.commit()
    db.refresh(order)
    order = (
        db.query(Order)
        .options(joinedload(Order.seller), joinedload(Order.items).joinedload(OrderItem.product))
        .filter(Order.id == order.id)
        .first()
    )
    return _order_to_response(order)


@router.patch("/orders/{order_id}/status", response_model=OrderResponse)
def update_order_status(
    order_id: int,
    data: OrderStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.WORKER])),
):
    order = (
        db.query(Order)
        .options(joinedload(Order.seller), joinedload(Order.items).joinedload(OrderItem.product))
        .filter(Order.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="주문을 찾을 수 없습니다.")

    allowed = STATUS_TRANSITIONS.get(order.status, [])
    if data.status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"'{order.status}' 상태에서 '{data.status}'(으)로 변경할 수 없습니다."
        )

    old_status = order.status
    order.status = data.status
    order.updated_at = datetime.utcnow()

    role_label = ROLE_LABELS_KR.get(current_user.role.value, "")
    changed_by_name = f"{current_user.full_name} ({role_label})"
    db.add(OrderHistory(
        order_id=order.id,
        changed_by_id=current_user.id,
        changed_by_name=changed_by_name,
        field_changed="status",
        old_value=STATUS_LABELS_KR.get(old_status.value, old_status.value),
        new_value=STATUS_LABELS_KR.get(data.status.value, data.status.value),
    ))

    db.commit()
    db.refresh(order)
    return _order_to_response(order)
