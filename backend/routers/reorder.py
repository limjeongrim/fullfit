import math
from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models.user import User, UserRole
from backend.models.product import Product
from backend.models.inventory import Inventory
from backend.models.inbound import Inbound
from backend.models.demand_history import DemandHistory
from backend.models.reorder import ReorderRecommendation
from backend.models.order_item import OrderItem
from backend.models.order import Order, OrderStatus
from backend.models.notification import NotificationType
from backend.core.dependencies import require_role
from backend.core.notify import create_notification

router = APIRouter()

ORDERING_COST = 50_000   # 원 (fixed per order)
DEFAULT_DAILY  = 5.0
LEAD_TIME      = 3       # days
SAFETY_DAYS    = 7       # days of buffer
_ROLES = [UserRole.ADMIN, UserRole.SELLER]


def _daily_demand(db: Session, product_id: int) -> float:
    since = date.today() - timedelta(days=29)
    total = (
        db.query(func.sum(DemandHistory.quantity_sold))
        .filter(DemandHistory.product_id == product_id,
                DemandHistory.date >= since)
        .scalar() or 0
    )
    return round(total / 30.0, 2) if total > 0 else DEFAULT_DAILY


def _unit_price(db: Session, product_id: int) -> float:
    row = (
        db.query(OrderItem.unit_price)
        .join(Order)
        .filter(OrderItem.product_id == product_id,
                Order.status != OrderStatus.CANCELLED)
        .order_by(Order.created_at.desc())
        .first()
    )
    return float(row[0]) if row else 20_000.0


def _eoq(annual_demand: float, unit_price: float) -> int:
    holding = unit_price * 0.2 or 4_000
    val = math.sqrt((2 * annual_demand * ORDERING_COST) / holding)
    return max(10, min(500, round(val)))


def _analyze(db: Session, product: Product) -> dict:
    demand = _daily_demand(db, product.id)
    stock = (
        db.query(func.sum(Inventory.quantity))
        .filter(Inventory.product_id == product.id)
        .scalar() or 0
    )
    safety = demand * SAFETY_DAYS
    rop = round(demand * LEAD_TIME + safety)
    eoq = _eoq(demand * 365, _unit_price(db, product.id))
    dos = round(stock / demand, 1) if demand > 0 else 999.0

    urgency = (
        "CRITICAL" if dos < 3
        else "WARNING" if dos < 7
        else "NORMAL"
    )
    return {
        "product_id": product.id,
        "product_name": product.name,
        "sku": product.sku,
        "seller_id": product.seller_id,
        "current_stock": stock,
        "reorder_point": rop,
        "recommended_qty": eoq,
        "daily_demand": demand,
        "days_of_stock": dos,
        "urgency": urgency,
        "needs_reorder": stock <= rop,
    }


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/reorder/check")
def check_reorder(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(_ROLES)),
):
    products_q = db.query(Product).filter(Product.is_active == True)
    if current_user.role == UserRole.SELLER:
        products_q = products_q.filter(Product.seller_id == current_user.id)
    products = products_q.all()

    admin_users = db.query(User).filter(User.role == UserRole.ADMIN).all()

    needs_reorder, safe_count = [], 0

    for p in products:
        data = _analyze(db, p)

        if data["needs_reorder"]:
            existing = (
                db.query(ReorderRecommendation)
                .filter(ReorderRecommendation.product_id == p.id,
                        ReorderRecommendation.status == "PENDING")
                .first()
            )
            if existing:
                existing.recommended_qty = data["recommended_qty"]
                existing.reorder_point   = data["reorder_point"]
                existing.current_stock   = data["current_stock"]
                existing.daily_demand    = data["daily_demand"]
                existing.updated_at      = datetime.utcnow()
                rec_id = existing.id
            else:
                rec = ReorderRecommendation(
                    product_id=p.id,
                    seller_id=p.seller_id,
                    recommended_qty=data["recommended_qty"],
                    reorder_point=data["reorder_point"],
                    current_stock=data["current_stock"],
                    daily_demand=data["daily_demand"],
                    lead_time_days=LEAD_TIME,
                    status="PENDING",
                )
                db.add(rec)
                db.flush()
                rec_id = rec.id

                create_notification(
                    db, p.seller_id, NotificationType.STOCK_LOW,
                    f"⚠️ {p.name} 재주문점 도달",
                    f"{p.name} 재주문점 도달 — 발주 검토 필요 (현재 {data['current_stock']}개)",
                )
                for admin in admin_users:
                    if admin.id != p.seller_id:
                        create_notification(
                            db, admin.id, NotificationType.STOCK_LOW,
                            f"⚠️ {p.name} 재주문점 도달",
                            f"[{p.sku}] {p.name} 재주문점 도달 — 발주 검토 필요",
                        )

            needs_reorder.append({**data, "recommendation_id": rec_id})
        else:
            safe_count += 1

    db.commit()

    needs_reorder.sort(key=lambda x: (
        {"CRITICAL": 0, "WARNING": 1}.get(x["urgency"], 2),
        x["days_of_stock"],
    ))

    return {"items": needs_reorder, "safe_count": safe_count}


@router.get("/reorder/list")
def list_reorders(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(_ROLES)),
):
    q = db.query(ReorderRecommendation).filter(
        ReorderRecommendation.status == "PENDING"
    )
    if current_user.role == UserRole.SELLER:
        q = q.filter(ReorderRecommendation.seller_id == current_user.id)
    recs = q.all()

    return [
        {
            "id": r.id,
            "product_id": r.product_id,
            "product_name": r.product.name,
            "sku": r.product.sku,
            "current_stock": r.current_stock,
            "reorder_point": r.reorder_point,
            "recommended_qty": r.recommended_qty,
            "daily_demand": r.daily_demand,
            "days_of_stock": (
                round(r.current_stock / r.daily_demand, 1)
                if r.daily_demand > 0 else 999
            ),
            "status": r.status,
            "created_at": str(r.created_at),
        }
        for r in recs
    ]


@router.post("/reorder/{rec_id}/order")
def place_order(
    rec_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(_ROLES)),
):
    rec = db.query(ReorderRecommendation).filter(
        ReorderRecommendation.id == rec_id
    ).first()
    if not rec:
        raise HTTPException(404, "추천 항목을 찾을 수 없습니다.")
    if rec.status != "PENDING":
        raise HTTPException(400, "이미 처리된 항목입니다.")

    inbound = Inbound(
        product_id=rec.product_id,
        lot_number=f"REORDER-{date.today().strftime('%Y%m%d')}-{rec.id}",
        expiry_date=date.today() + timedelta(days=365),
        quantity=rec.recommended_qty,
        inbound_date=date.today() + timedelta(days=rec.lead_time_days),
        note=f"자동 발주 추천 (EOQ {rec.recommended_qty}개, 재주문점 도달)",
        created_by=current_user.id,
    )
    db.add(inbound)

    rec.status = "ORDERED"
    rec.updated_at = datetime.utcnow()
    db.commit()

    return {"message": "발주 요청이 등록되었습니다", "inbound_id": inbound.id}


@router.post("/reorder/{rec_id}/dismiss")
def dismiss_reorder(
    rec_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(_ROLES)),
):
    rec = db.query(ReorderRecommendation).filter(
        ReorderRecommendation.id == rec_id
    ).first()
    if not rec:
        raise HTTPException(404, "추천 항목을 찾을 수 없습니다.")

    rec.status = "DISMISSED"
    rec.updated_at = datetime.utcnow()
    db.commit()

    return {"message": "무시 처리되었습니다."}
