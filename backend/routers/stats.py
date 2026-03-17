from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models.user import User, UserRole
from backend.models.order import Order, OrderStatus, OrderChannel
from backend.models.order_item import OrderItem
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


def _demand_forecast(db: Session, seller_id: int = None) -> list:
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)

    sales_q = (
        db.query(OrderItem.product_id, func.sum(OrderItem.quantity).label("total"))
        .join(Order)
        .filter(Order.created_at >= thirty_days_ago, Order.status != OrderStatus.CANCELLED)
    )
    if seller_id:
        sales_q = sales_q.filter(Order.seller_id == seller_id)
    sales_rows = sales_q.group_by(OrderItem.product_id).all()
    sales_map = {r.product_id: r.total for r in sales_rows}

    inv_q = db.query(Inventory.product_id, func.sum(Inventory.quantity).label("total")).group_by(Inventory.product_id)
    inv_rows = inv_q.all()
    inv_map = {r.product_id: r.total for r in inv_rows}

    products_q = db.query(Product).filter(Product.is_active == True)
    if seller_id:
        products_q = products_q.filter(Product.seller_id == seller_id)
    products = products_q.all()

    results = []
    for p in products:
        total_sold = sales_map.get(p.id, 0)
        avg_daily = round(total_sold / 30.0, 2)
        current_stock = inv_map.get(p.id, 0)
        days_of_stock = round(current_stock / avg_daily, 1) if avg_daily > 0 else 999
        results.append({
            "product_id": p.id,
            "product_name": p.name,
            "sku": p.sku,
            "avg_daily_sales": avg_daily,
            "current_stock": current_stock,
            "days_of_stock": days_of_stock,
            "forecast_7day": round(avg_daily * 7),
            "forecast_30day": round(avg_daily * 30),
            "reorder_recommended": days_of_stock < 14,
        })
    results.sort(key=lambda x: x["days_of_stock"])
    return results


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

    # Demand alert count (products needing reorder)
    forecast = _demand_forecast(db)
    demand_alert_count = sum(1 for f in forecast if f["reorder_recommended"])

    return {
        "today_orders": today_orders,
        "pending_orders": pending_orders,
        "low_stock_count": low_stock_count,
        "expiry_alert_count": expiry_alert_count,
        "demand_alert_count": demand_alert_count,
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


@router.get("/stats/demand-forecast")
def demand_forecast(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN])),
):
    return _demand_forecast(db)


@router.get("/stats/demand-forecast/seller")
def demand_forecast_seller(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.SELLER])),
):
    return _demand_forecast(db, seller_id=current_user.id)
