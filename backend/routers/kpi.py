from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.database import get_db
from backend.models.order import Order, OrderStatus
from backend.models.order_item import OrderItem
from backend.models.delivery import Delivery, DeliveryStatus
from backend.models.return_request import ReturnRequest
from backend.models.inventory import Inventory
from backend.models.user import UserRole
from backend.core.dependencies import require_role

router = APIRouter(prefix="/kpi", tags=["KPI"])


def _date_range(days: int):
    end = date.today()
    start = end - timedelta(days=days - 1)
    return start, end


@router.get("/summary")
def kpi_summary(
    days: int = Query(default=30, ge=7, le=90),
    db: Session = Depends(get_db),
    _=Depends(require_role([UserRole.ADMIN])),
):
    start, end = _date_range(days)
    start_dt = datetime.combine(start, datetime.min.time())
    end_dt = datetime.combine(end, datetime.max.time())

    # ── 출고정확도: DELIVERED / (DELIVERED + CANCELLED) ──────────────────────
    shipped = db.query(Order).filter(
        Order.status.in_([OrderStatus.DELIVERED, OrderStatus.CANCELLED]),
        Order.created_at.between(start_dt, end_dt),
    ).count()
    delivered = db.query(Order).filter(
        Order.status == OrderStatus.DELIVERED,
        Order.created_at.between(start_dt, end_dt),
    ).count()
    outbound_accuracy = round(delivered / shipped * 100, 1) if shipped else 0

    # ── 평균 처리시간: RECEIVED → SHIPPED (hours) ─────────────────────────────
    shipped_orders = (
        db.query(Order)
        .join(Delivery, Delivery.order_id == Order.id)
        .filter(
            Order.status.in_([OrderStatus.SHIPPED, OrderStatus.DELIVERED]),
            Order.created_at.between(start_dt, end_dt),
            Delivery.shipped_at.isnot(None),
        )
        .with_entities(Order.created_at, Delivery.shipped_at)
        .all()
    )
    if shipped_orders:
        diffs = [(s.shipped_at - s.created_at).total_seconds() / 3600 for s in shipped_orders if s.shipped_at > s.created_at]
        avg_hours = round(sum(diffs) / len(diffs), 1) if diffs else 0
    else:
        avg_hours = 0

    # ── 반품률: returns / shipped ────────────────────────────────────────────
    returns_count = db.query(ReturnRequest).filter(
        ReturnRequest.created_at.between(start_dt, end_dt),
    ).count()
    return_rate = round(returns_count / delivered * 100, 1) if delivered else 0

    # ── 재고 정확도 placeholder (재고 정확도는 실사 기준) ─────────────────────
    inventory_accuracy = 98.5  # placeholder; real value needs cycle count data

    # ── 셀러별 주문량 ───────────────────────────────────────────────────────────
    from backend.models.user import User
    seller_orders = (
        db.query(User.full_name, func.count(Order.id).label("cnt"))
        .join(Order, Order.seller_id == User.id)
        .filter(
            User.role == UserRole.SELLER,
            Order.created_at.between(start_dt, end_dt),
        )
        .group_by(User.id, User.full_name)
        .order_by(func.count(Order.id).desc())
        .all()
    )

    # ── 채널별 주문량 ────────────────────────────────────────────────────────────
    from backend.models.order import OrderChannel
    channel_orders = (
        db.query(Order.channel, func.count(Order.id).label("cnt"))
        .filter(Order.created_at.between(start_dt, end_dt))
        .group_by(Order.channel)
        .all()
    )
    channel_labels = {
        "SMARTSTORE": "스마트스토어",
        "OLIVEYOUNG": "올리브영",
        "CAFE24": "카페24",
        "ZIGZAG": "지그재그",
        "MANUAL": "수동",
    }

    # ── 일별 주문량 (last N days) ────────────────────────────────────────────
    daily = (
        db.query(func.date(Order.created_at).label("d"), func.count(Order.id).label("cnt"))
        .filter(Order.created_at.between(start_dt, end_dt))
        .group_by(func.date(Order.created_at))
        .order_by(func.date(Order.created_at))
        .all()
    )

    # Total orders & revenue in period
    total_orders = db.query(Order).filter(Order.created_at.between(start_dt, end_dt)).count()
    from sqlalchemy import func as sqlfunc
    revenue_row = db.query(sqlfunc.sum(Order.total_amount)).filter(
        Order.status == OrderStatus.DELIVERED,
        Order.created_at.between(start_dt, end_dt),
    ).scalar()
    total_revenue = int(revenue_row or 0)

    return {
        "period_days": days,
        "kpis": {
            "outbound_accuracy": outbound_accuracy,
            "avg_processing_hours": avg_hours,
            "return_rate": return_rate,
            "inventory_accuracy": inventory_accuracy,
            "total_orders": total_orders,
            "total_revenue": total_revenue,
            "delivered_count": delivered,
            "return_count": returns_count,
        },
        "seller_breakdown": [{"name": r.full_name, "count": r.cnt} for r in seller_orders],
        "channel_breakdown": [{"channel": channel_labels.get(r.channel, r.channel), "count": r.cnt} for r in channel_orders],
        "daily_orders": [{"date": str(r.d), "count": r.cnt} for r in daily],
    }
