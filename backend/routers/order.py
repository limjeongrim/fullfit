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
from backend.models.product import Product
from backend.schemas.order import (
    OrderCreate, OrderResponse, OrderListResponse, OrderListItem,
    OrderStatusUpdate, OrderItemResponse,
)
from backend.core.dependencies import get_current_user, require_role

router = APIRouter()


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
                quantity=it.quantity,
                unit_price=it.unit_price,
            )
            for it in order.items
        ],
        created_at=order.created_at,
        updated_at=order.updated_at,
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
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.WORKER])),
):
    q = db.query(Order).options(joinedload(Order.seller), joinedload(Order.items))
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
        .options(joinedload(Order.seller), joinedload(Order.items))
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
    text = content.decode("utf-8-sig")  # handle BOM
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
    seller_id = current_user.id if current_user.role == UserRole.SELLER else data.items[0].product_id if False else current_user.id
    # Sellers always own their own orders; admins create on their own account (or extend later)
    if current_user.role == UserRole.SELLER:
        seller_id = current_user.id
    else:
        seller_id = current_user.id  # Admin creates under their own account for now

    order = _build_order(db, data, seller_id)
    db.commit()
    db.refresh(order)
    # reload with relationships
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

    order.status = data.status
    order.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(order)
    return _order_to_response(order)
