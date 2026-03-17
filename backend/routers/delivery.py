from datetime import date, datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from backend.database import get_db
from backend.models.user import User, UserRole
from backend.models.order import Order, OrderStatus
from backend.models.delivery import Delivery, DeliveryStatus
from backend.schemas.delivery import DeliveryCreate, DeliveryResponse, DeliveryStatusUpdate
from backend.core.dependencies import get_current_user, require_role
from backend.core.notify import create_notification
from backend.models.notification import NotificationType

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


def _auto_advance_deliveries(db: Session) -> None:
    """Simulate courier API callbacks by auto-advancing stale delivery statuses."""
    now = datetime.utcnow()

    # IN_TRANSIT → OUT_FOR_DELIVERY after 2 days
    in_transit = (
        db.query(Delivery)
        .filter(
            Delivery.status == DeliveryStatus.IN_TRANSIT,
            Delivery.created_at <= now - timedelta(days=2),
        )
        .all()
    )
    for d in in_transit:
        d.status = DeliveryStatus.OUT_FOR_DELIVERY
        d.updated_at = now

    # OUT_FOR_DELIVERY → DELIVERED after 3 days
    out_for_delivery = (
        db.query(Delivery)
        .filter(
            Delivery.status == DeliveryStatus.OUT_FOR_DELIVERY,
            Delivery.created_at <= now - timedelta(days=3),
        )
        .all()
    )
    for d in out_for_delivery:
        d.status = DeliveryStatus.DELIVERED
        d.actual_delivery = date.today()
        d.updated_at = now
        order = db.query(Order).filter(Order.id == d.order_id).first()
        if order and order.status != OrderStatus.DELIVERED:
            order.status = OrderStatus.DELIVERED
            order.updated_at = now

    if in_transit or out_for_delivery:
        db.commit()


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/deliveries/", response_model=List[DeliveryResponse])
def list_deliveries(
    seller_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN])),
):
    _auto_advance_deliveries(db)
    q = db.query(Delivery).join(Order).options(joinedload(Delivery.order))
    if seller_id:
        q = q.filter(Order.seller_id == seller_id)
    rows = q.order_by(Delivery.created_at.desc()).all()
    return [_to_response(d) for d in rows]


@router.get("/deliveries/seller", response_model=List[DeliveryResponse])
def list_deliveries_seller(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.SELLER])),
):
    _auto_advance_deliveries(db)
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


@router.get("/deliveries/tracking/{tracking_number}")
def get_tracking(
    tracking_number: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    d = (
        db.query(Delivery)
        .options(joinedload(Delivery.order))
        .filter(Delivery.tracking_number == tracking_number)
        .first()
    )
    if not d:
        raise HTTPException(status_code=404, detail="운송장을 찾을 수 없습니다.")
    if current_user.role == UserRole.SELLER and d.order.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다.")

    base = d.created_at
    carrier_hub = {"CJ": "군포HUB", "HANJIN": "대전HUB", "LOTTE": "용인HUB", "ETC": "물류HUB"}
    hub = carrier_hub.get(d.carrier.value if hasattr(d.carrier, "value") else d.carrier, "물류HUB")

    timeline = [
        {
            "timestamp": base.isoformat(),
            "status": "READY",
            "location": "풀핏 물류센터",
            "message": "송장 발행완료 - 풀핏 물류센터",
            "done": True,
        }
    ]

    if d.status in (DeliveryStatus.IN_TRANSIT, DeliveryStatus.OUT_FOR_DELIVERY, DeliveryStatus.DELIVERED):
        timeline.append({
            "timestamp": (base + timedelta(hours=2)).isoformat(),
            "status": "IN_TRANSIT",
            "location": "풀핏 물류센터",
            "message": "집화완료 - 풀핏 물류센터",
            "done": True,
        })
        timeline.append({
            "timestamp": (base + timedelta(hours=8)).isoformat(),
            "status": "IN_TRANSIT",
            "location": hub,
            "message": f"간선상차 - {hub}",
            "done": True,
        })
    else:
        timeline.append({"timestamp": None, "status": "IN_TRANSIT", "location": "풀핏 물류센터", "message": "집화완료 - 풀핏 물류센터", "done": False})
        timeline.append({"timestamp": None, "status": "IN_TRANSIT", "location": hub, "message": f"간선상차 - {hub}", "done": False})

    if d.status in (DeliveryStatus.OUT_FOR_DELIVERY, DeliveryStatus.DELIVERED):
        timeline.append({
            "timestamp": (base + timedelta(hours=20)).isoformat(),
            "status": "OUT_FOR_DELIVERY",
            "location": "수신자 관할 배송지",
            "message": "배달출발 - 수신자 관할 배송지",
            "done": True,
        })
    else:
        timeline.append({"timestamp": None, "status": "OUT_FOR_DELIVERY", "location": "수신자 관할 배송지", "message": "배달출발 - 수신자 관할 배송지", "done": False})

    if d.status == DeliveryStatus.DELIVERED:
        ts = (base + timedelta(hours=24)).isoformat() if not d.actual_delivery else datetime.combine(d.actual_delivery, datetime.min.time()).isoformat()
        timeline.append({"timestamp": ts, "status": "DELIVERED", "location": "수신자 주소", "message": "배달완료", "done": True})
    else:
        timeline.append({"timestamp": None, "status": "DELIVERED", "location": "수신자 주소", "message": "배달완료", "done": False})

    return {
        "tracking_number": tracking_number,
        "carrier": d.carrier,
        "current_status": d.status,
        "timeline": timeline,
    }


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

    order.status = OrderStatus.SHIPPED
    order.updated_at = datetime.utcnow()

    create_notification(
        db, order.seller_id, NotificationType.DELIVERY_UPDATE,
        "배송 등록 완료",
        f"주문 {order.order_number}의 송장이 등록되었습니다. (운송장: {data.tracking_number})",
    )

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
        order = db.query(Order).filter(Order.id == delivery.order_id).first()
        if order:
            order.status = OrderStatus.DELIVERED
            order.updated_at = datetime.utcnow()

    status_labels = {
        "READY": "배송 준비", "IN_TRANSIT": "배송중", "OUT_FOR_DELIVERY": "배달중",
        "DELIVERED": "배달완료", "FAILED": "배달실패",
    }
    label = status_labels.get(data.status.value if hasattr(data.status, "value") else data.status, data.status)
    create_notification(
        db, delivery.order.seller_id, NotificationType.DELIVERY_UPDATE,
        f"배송 상태 변경: {label}",
        f"주문 {delivery.order.order_number} 배송이 [{label}] 상태로 변경되었습니다.",
    )

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
