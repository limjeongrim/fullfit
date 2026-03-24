from datetime import date, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models.user import User, UserRole
from backend.models.demand_history import DemandHistory
from backend.models.inventory import Inventory
from backend.models.product import Product
from backend.models.promotion import Promotion
from backend.core.dependencies import require_role

router = APIRouter()

PROMO_ROLES = [UserRole.ADMIN, UserRole.SELLER]


def _get_daily_totals(db: Session, product_id: int, days: int = 90) -> list:
    """Returns list of {date, quantity} dicts sorted oldest → newest, filling gaps with 0."""
    since = date.today() - timedelta(days=days - 1)
    rows = (
        db.query(DemandHistory.date, func.sum(DemandHistory.quantity_sold).label("total"))
        .filter(DemandHistory.product_id == product_id, DemandHistory.date >= since)
        .group_by(DemandHistory.date)
        .order_by(DemandHistory.date)
        .all()
    )
    date_map = {r.date: r.total for r in rows}
    return [
        {"date": str(date.today() - timedelta(days=days - 1 - i)),
         "quantity": date_map.get(date.today() - timedelta(days=days - 1 - i), 0)}
        for i in range(days)
    ]


def _compute_ma(values: list, window: int) -> float:
    if not values:
        return 0.0
    tail = values[-window:] if len(values) >= window else values
    return sum(tail) / len(tail) if tail else 0.0


def _compute_mape(quantities: list) -> tuple:
    """Rolling MAPE for MA_7, MA_14, MA_30 evaluated on the last 30 days."""
    if len(quantities) < 37:
        return 0.0, 0.0, 0.0

    errors_7, errors_14, errors_30 = [], [], []
    eval_start = len(quantities) - 30

    for i in range(eval_start, len(quantities)):
        actual = quantities[i]
        hist = quantities[:i]
        if not hist:
            continue

        pred_7  = sum(hist[-7:])  / min(7,  len(hist))
        pred_14 = sum(hist[-14:]) / min(14, len(hist))
        pred_30 = sum(hist[-30:]) / min(30, len(hist))

        if actual > 0:
            errors_7.append(abs(actual - pred_7) / actual)
            errors_14.append(abs(actual - pred_14) / actual)
            errors_30.append(abs(actual - pred_30) / actual)

    mape_7  = round(sum(errors_7)  / len(errors_7)  * 100, 1) if errors_7  else 0.0
    mape_14 = round(sum(errors_14) / len(errors_14) * 100, 1) if errors_14 else 0.0
    mape_30 = round(sum(errors_30) / len(errors_30) * 100, 1) if errors_30 else 0.0
    return mape_7, mape_14, mape_30


def _promotion_risk(db: Session, current_stock: int, avg_daily: float):
    """Returns (risk, upcoming_promotion_dict, required_stock_int) from Promotion records."""
    today = date.today()
    promos = (
        db.query(Promotion)
        .filter(
            Promotion.start_date <= today + timedelta(days=60),
            Promotion.end_date >= today,
        )
        .all()
    )

    max_required = 0.0
    worst = None
    for promo in promos:
        duration = max((promo.end_date - promo.start_date).days + 1, 1)
        daily_base = avg_daily if avg_daily > 0 else 0.5
        required = daily_base * promo.expected_order_multiplier * duration
        if required > max_required:
            max_required = required
            worst = promo

    if worst and max_required > 0:
        if current_stock < max_required:
            risk = "HIGH"
        elif current_stock < max_required * 1.5:
            risk = "MEDIUM"
        else:
            risk = "LOW"
        upcoming = {
            "name": worst.name,
            "start_date": str(worst.start_date),
            "multiplier": worst.expected_order_multiplier,
        }
    else:
        risk, upcoming, max_required = "LOW", None, 0.0

    return risk, upcoming, round(max_required)


def _build_product_forecast(db: Session, product: Product) -> dict:
    daily = _get_daily_totals(db, product.id, days=90)
    quantities = [d["quantity"] for d in daily]

    ma_7  = _compute_ma(quantities, 7)
    ma_14 = _compute_ma(quantities, 14)
    ma_30 = _compute_ma(quantities, 30)
    mape_7, mape_14, mape_30 = _compute_mape(quantities)

    mape_map = {7: mape_7, 14: mape_14, 30: mape_30}
    recommended_window = min(mape_map, key=mape_map.get)
    best_ma   = {7: ma_7, 14: ma_14, 30: ma_30}[recommended_window]
    best_mape = mape_map[recommended_window]

    current_stock = (
        db.query(func.sum(Inventory.quantity))
        .filter(Inventory.product_id == product.id)
        .scalar() or 0
    )
    days_of_stock = round(current_stock / best_ma, 1) if best_ma > 0 else 999

    # Trend: last 7d avg vs previous 7d avg
    last_7 = quantities[-7:]  if len(quantities) >= 7  else quantities
    prev_7 = quantities[-14:-7] if len(quantities) >= 14 else []
    avg_last = sum(last_7) / len(last_7) if last_7 else 0
    avg_prev = sum(prev_7) / len(prev_7) if prev_7 else avg_last
    if avg_prev > 0:
        change = (avg_last - avg_prev) / avg_prev
        trend = "increasing" if change > 0.1 else "decreasing" if change < -0.1 else "stable"
    else:
        trend = "stable"

    promo_risk, upcoming_promo, promo_req = _promotion_risk(db, current_stock, best_ma)

    return {
        "product_id": product.id,
        "product_name": product.name,
        "sku": product.sku,
        "current_stock": current_stock,
        "avg_daily_sales": round(best_ma, 2),
        "recommended_daily_demand": round(best_ma, 2),
        "days_of_stock": days_of_stock,
        "forecast_7day": round(best_ma * 7),
        "forecast_30day": round(best_ma * 30),
        "reorder_recommended": days_of_stock < 14,
        "reorder_alert": days_of_stock < 14,
        "promotion_risk": promo_risk,
        "upcoming_promotion": upcoming_promo,
        "promotion_required_stock": promo_req,
        "trend": trend,
        "recommended_window": recommended_window,
        "mape": best_mape,
    }


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/forecast/history/{product_id}")
def get_history(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(PROMO_ROLES)),
):
    """Last 90 days of daily sales, summed across channels."""
    return _get_daily_totals(db, product_id, days=90)


@router.get("/forecast/predict/{product_id}")
def get_prediction(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(PROMO_ROLES)),
):
    """MA forecasts + MAPE evaluation for a single product."""
    daily = _get_daily_totals(db, product_id, days=90)
    quantities = [d["quantity"] for d in daily]

    ma_7  = round(_compute_ma(quantities, 7), 2)
    ma_14 = round(_compute_ma(quantities, 14), 2)
    ma_30 = round(_compute_ma(quantities, 30), 2)
    mape_7, mape_14, mape_30 = _compute_mape(quantities)

    mape_map = {7: mape_7, 14: mape_14, 30: mape_30}
    recommended_window = min(mape_map, key=mape_map.get)
    best_ma = {7: ma_7, 14: ma_14, 30: ma_30}[recommended_window]

    current_stock = (
        db.query(func.sum(Inventory.quantity))
        .filter(Inventory.product_id == product_id)
        .scalar() or 0
    )
    days_of_stock = round(current_stock / best_ma, 1) if best_ma > 0 else 999

    today = date.today()
    forecast_7d = [
        {"date": str(today + timedelta(days=i + 1)), "quantity": round(best_ma)}
        for i in range(7)
    ]

    return {
        "history": daily[-30:],
        "forecast_7d": forecast_7d,
        "ma_7": ma_7,
        "ma_14": ma_14,
        "ma_30": ma_30,
        "mape_7": mape_7,
        "mape_14": mape_14,
        "mape_30": mape_30,
        "recommended_window": recommended_window,
        "days_of_stock": days_of_stock,
        "reorder_alert": days_of_stock < 14,
    }


@router.get("/forecast/summary")
def get_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(PROMO_ROLES)),
):
    """Forecast summary for all products (admin) or seller's own products."""
    products_q = db.query(Product).filter(Product.is_active == True)
    if current_user.role == UserRole.SELLER:
        products_q = products_q.filter(Product.seller_id == current_user.id)
    products = products_q.all()

    results = [_build_product_forecast(db, p) for p in products]
    results.sort(key=lambda x: x["days_of_stock"])
    return results
