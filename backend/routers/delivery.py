from datetime import date, datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from backend.database import get_db
from backend.models.user import User, UserRole
from backend.models.order import Order, OrderStatus
from backend.models.delivery import Delivery, DeliveryStatus
from backend.schemas.delivery import DeliveryCreate, DeliveryResponse, DeliveryStatusUpdate
from backend.core.dependencies import get_current_user, require_role

router = APIRouter()


# ── Helper ─────────────────────────────────────────────────────────────────────

def _to_response(d: Delivery) -> DeliveryResponse:
    return DeliveryResponse(
        id=d.id,
        order_id=d.order_id,
        order_number=d.order.order_number,
        receiver_name=d.order.receiver_name,
        receiver_address=d.order.receiver_address,
        tracking_number=d.tracking_number,
        carrier=d.carrier,
        status=d.status,
        estimated_delivery=d.estimated_delivery,
        actual_delivery=d.actual_delivery,
        note=d.note,
        created_at=d.created_at,
        updated_at=d.updated_at,
    )


def _load(delivery_id: int, db: Session) -> Delivery:
    d = (
        db.query(Delivery)
        .options(joinedload(Delivery.order))
        .filter(Delivery.id == delivery_id)
        .first()
    )
    if not d:
        raise HTTPException(status_code=404, detail="배송 정보를 찾을 수 없습니다.")
    return d


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/deliveries/", response_model=List[DeliveryResponse])
def list_deliveries(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN])),
):
    rows = (
        db.query(Delivery)
        .options(joinedload(Delivery.order))
        .order_by(Delivery.created_at.desc())
        .all()
    )
    return [_to_response(d) for d in rows]


@router.get("/deliveries/seller", response_model=List[DeliveryResponse])
def list_deliveries_seller(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.SELLER])),
):
    rows = (
        db.query(Delivery)
        .join(Order)
        .options(joinedload(Delivery.order))
        .filter(Order.seller_id == current_user.id)
        .order_by(Delivery.created_at.desc())
        .all()
    )
    return [_to_response(d) for d in rows]


@router.get("/deliveries/delayed", response_model=List[DeliveryResponse])
def list_delayed_deliveries(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN])),
):
    today = date.today()
    rows = (
        db.query(Delivery)
        .options(joinedload(Delivery.order))
        .filter(
            Delivery.estimated_delivery < today,
            Delivery.status.notin_([DeliveryStatus.DELIVERED, DeliveryStatus.FAILED]),
        )
        .order_by(Delivery.estimated_delivery.asc())
        .all()
    )
    return [_to_response(d) for d in rows]


@router.post("/deliveries/", response_model=DeliveryResponse)
def create_delivery(
    data: DeliveryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN])),
):
    order = db.query(Order).filter(Order.id == data.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="주문을 찾을 수 없습니다.")
    if db.query(Delivery).filter(Delivery.order_id == data.order_id).first():
        raise HTTPException(status_code=400, detail="이미 송장이 등록된 주문입니다.")

    delivery = Delivery(
        order_id=data.order_id,
        tracking_number=data.tracking_number,
        carrier=data.carrier,
        status=DeliveryStatus.READY,
        estimated_delivery=data.estimated_delivery,
        note=data.note,
    )
    db.add(delivery)

    # Auto-update linked order to SHIPPED
    order.status = OrderStatus.SHIPPED
    order.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(delivery)
    return _to_response(_load(delivery.id, db))


@router.patch("/deliveries/{delivery_id}/status", response_model=DeliveryResponse)
def update_delivery_status(
    delivery_id: int,
    data: DeliveryStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN])),
):
    delivery = _load(delivery_id, db)

    delivery.status = data.status
    delivery.updated_at = datetime.utcnow()
    if data.note is not None:
        delivery.note = data.note

    if data.status == DeliveryStatus.DELIVERED:
        delivery.actual_delivery = date.today()
        # Auto-update linked order to DELIVERED
        order = db.query(Order).filter(Order.id == delivery.order_id).first()
        if order:
            order.status = OrderStatus.DELIVERED
            order.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(delivery)
    return _to_response(_load(delivery_id, db))


@router.get("/deliveries/{delivery_id}", response_model=DeliveryResponse)
def get_delivery(
    delivery_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    delivery = _load(delivery_id, db)
    if current_user.role == UserRole.SELLER and delivery.order.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다.")
    if current_user.role == UserRole.WORKER:
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다.")
    return _to_response(delivery)
