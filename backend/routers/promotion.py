from datetime import date, timedelta, datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models.user import User, UserRole
from backend.models.promotion import Promotion
from backend.models.inventory import Inventory
from backend.models.product import Product
from backend.models.order import Order, OrderStatus
from backend.models.order_item import OrderItem
from backend.schemas.promotion import PromotionCreate, PromotionResponse
from backend.core.dependencies import require_role

router = APIRouter(prefix="/promotions", tags=["Promotions"])


def _to_response(p: Promotion) -> PromotionResponse:
    today = date.today()
    days_until = (p.start_date - today).days
    is_active = p.start_date <= today <= p.end_date
    return PromotionResponse(
        id=p.id,
        name=p.name,
        channel=p.channel,
        start_date=p.start_date,
        end_date=p.end_date,
        expected_order_multiplier=p.expected_order_multiplier,
        note=p.note,
        created_at=p.created_at,
        days_until_start=days_until,
        is_active=is_active,
    )


@router.get("/", response_model=List[PromotionResponse])
def list_promotions(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.SELLER])),
):
    rows = db.query(Promotion).order_by(Promotion.start_date.asc()).all()
    return [_to_response(p) for p in rows]


@router.post("/", response_model=PromotionResponse, status_code=201)
def create_promotion(
    body: PromotionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN])),
):
    p = Promotion(**body.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return _to_response(p)


@router.delete("/{promotion_id}", status_code=204)
def delete_promotion(
    promotion_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN])),
):
    p = db.query(Promotion).filter(Promotion.id == promotion_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="프로모션을 찾을 수 없습니다.")
    db.delete(p)
    db.commit()


@router.get("/alerts")
def promotion_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN])),
):
    today = date.today()
    upcoming = (
        db.query(Promotion)
        .filter(Promotion.start_date <= today + timedelta(days=30), Promotion.end_date >= today)
        .all()
    )

    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    # avg daily sales per product over last 30 days
    sales_rows = (
        db.query(OrderItem.product_id, func.sum(OrderItem.quantity).label("total"))
        .join(Order)
        .filter(Order.created_at >= thirty_days_ago, Order.status != OrderStatus.CANCELLED)
        .group_by(OrderItem.product_id)
        .all()
    )
    sales_map = {r.product_id: r.total / 30.0 for r in sales_rows}

    # current stock per product
    inv_rows = (
        db.query(Inventory.product_id, func.sum(Inventory.quantity).label("total"))
        .group_by(Inventory.product_id)
        .all()
    )
    inv_map = {r.product_id: r.total for r in inv_rows}

    products = db.query(Product).filter(Product.is_active == True).all()

    alerts = []
    for promo in upcoming:
        duration = max((promo.end_date - promo.start_date).days + 1, 1)
        for product in products:
            avg_daily = sales_map.get(product.id, 0.1)
            required = avg_daily * promo.expected_order_multiplier * duration
            current = inv_map.get(product.id, 0)
            if current < required:
                alerts.append({
                    "promotion_id": promo.id,
                    "promotion_name": promo.name,
                    "channel": promo.channel,
                    "start_date": str(promo.start_date),
                    "end_date": str(promo.end_date),
                    "product_id": product.id,
                    "product_name": product.name,
                    "sku": product.sku,
                    "current_stock": current,
                    "required_stock": round(required),
                    "shortage": round(max(required - current, 0)),
                })
    return alerts
