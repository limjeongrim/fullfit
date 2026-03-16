from datetime import date, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models.user import User, UserRole
from backend.models.order import Order, OrderStatus, OrderChannel
from backend.models.inventory import Inventory
from backend.models.product import Product
from backend.core.dependencies import require_role

router = APIRouter()


def _weekly_orders(db: Session, seller_id: int = None) -> list:
    today = date.today()
    result = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        q = db.query(func.count(Order.id)).filter(func.date(Order.created_at) == str(d))
        if seller_id:
            q = q.filter(Order.seller_id == seller_id)
        result.append({"date": str(d), "count": q.scalar() or 0})
    return result


def _channel_breakdown(db: Session, seller_id: int = None) -> list:
    q = db.query(Order.channel, func.count(Order.id)).group_by(Order.channel)
    if seller_id:
        q = q.filter(Order.seller_id == seller_id)
    return [{"channel": row[0], "count": row[1]} for row in q.all()]


def _status_breakdown(db: Session) -> list:
    rows = db.query(Order.status, func.count(Order.id)).group_by(Order.status).all()
    return [{"status": row[0], "count": row[1]} for row in rows]


@router.get("/stats/admin")
def admin_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN])),
):
    today = str(date.today())

    today_orders = (
        db.query(func.count(Order.id))
        .filter(func.date(Order.created_at) == today)
        .scalar() or 0
    )
    pending_orders = (
        db.query(func.count(Order.id))
        .filter(Order.status.in_([OrderStatus.RECEIVED, OrderStatus.PICKING]))
        .scalar() or 0
    )
    low_stock_count = (
        db.query(func.count(Inventory.id))
        .filter(Inventory.quantity < 50)
        .scalar() or 0
    )
    expiry_threshold = str(date.today() + timedelta(days=30))
    expiry_alert_count = (
        db.query(func.count(Inventory.id))
        .filter(Inventory.expiry_date <= expiry_threshold)
        .scalar() or 0
    )

    return {
        "today_orders": today_orders,
        "pending_orders": pending_orders,
        "low_stock_count": low_stock_count,
        "expiry_alert_count": expiry_alert_count,
        "weekly_orders": _weekly_orders(db),
        "channel_breakdown": _channel_breakdown(db),
        "status_breakdown": _status_breakdown(db),
    }


@router.get("/stats/seller")
def seller_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.SELLER])),
):
    today = str(date.today())
    sid = current_user.id

    today_orders = (
        db.query(func.count(Order.id))
        .filter(Order.seller_id == sid, func.date(Order.created_at) == today)
        .scalar() or 0
    )
    total_orders = (
        db.query(func.count(Order.id))
        .filter(Order.seller_id == sid)
        .scalar() or 0
    )
    low_stock_count = (
        db.query(func.count(Inventory.id))
        .join(Product)
        .filter(Product.seller_id == sid, Inventory.quantity < 50)
        .scalar() or 0
    )
    expiry_threshold = str(date.today() + timedelta(days=30))
    expiry_alert_count = (
        db.query(func.count(Inventory.id))
        .join(Product)
        .filter(Product.seller_id == sid, Inventory.expiry_date <= expiry_threshold)
        .scalar() or 0
    )

    return {
        "today_orders": today_orders,
        "total_orders": total_orders,
        "low_stock_count": low_stock_count,
        "expiry_alert_count": expiry_alert_count,
        "weekly_orders": _weekly_orders(db, seller_id=sid),
        "channel_breakdown": _channel_breakdown(db, seller_id=sid),
    }
