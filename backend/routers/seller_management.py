from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models.user import User, UserRole
from backend.models.product import Product
from backend.models.inventory import Inventory
from backend.models.order import Order, OrderStatus
from backend.models.settlement import Settlement, SettlementStatus
from backend.core.dependencies import require_role

router = APIRouter(prefix="/sellers", tags=["Sellers"])


def _seller_stats(db: Session, seller_id: int) -> dict:
    total_products = (
        db.query(func.count(Product.id))
        .filter(Product.seller_id == seller_id, Product.is_active == True)
        .scalar() or 0
    )
    total_orders = (
        db.query(func.count(Order.id))
        .filter(Order.seller_id == seller_id)
        .scalar() or 0
    )
    total_inventory = (
        db.query(func.sum(Inventory.quantity))
        .join(Product)
        .filter(Product.seller_id == seller_id)
        .scalar() or 0
    )
    return {
        "total_products": total_products,
        "total_orders": total_orders,
        "total_inventory": int(total_inventory),
    }


@router.get("/")
def list_sellers(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN])),
):
    sellers = (
        db.query(User)
        .filter(User.role == UserRole.SELLER)
        .order_by(User.joined_at.desc())
        .all()
    )
    result = []
    for s in sellers:
        stats = _seller_stats(db, s.id)
        result.append({
            "id": s.id,
            "email": s.email,
            "full_name": s.full_name,
            "company_name": s.company_name,
            "business_number": s.business_number,
            "is_active": s.is_active,
            "joined_at": s.joined_at.isoformat() if s.joined_at else None,
            **stats,
        })
    return result


@router.patch("/{seller_id}/toggle-active")
def toggle_seller_active(
    seller_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN])),
):
    seller = db.query(User).filter(User.id == seller_id, User.role == UserRole.SELLER).first()
    if not seller:
        raise HTTPException(status_code=404, detail="셀러를 찾을 수 없습니다.")
    seller.is_active = not seller.is_active
    db.commit()
    db.refresh(seller)
    return {"id": seller.id, "is_active": seller.is_active}


@router.get("/{seller_id}/summary")
def seller_summary(
    seller_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN])),
):
    seller = db.query(User).filter(User.id == seller_id, User.role == UserRole.SELLER).first()
    if not seller:
        raise HTTPException(status_code=404, detail="셀러를 찾을 수 없습니다.")

    stats = _seller_stats(db, seller_id)

    products = (
        db.query(Product)
        .filter(Product.seller_id == seller_id, Product.is_active == True)
        .all()
    )

    recent_orders = (
        db.query(Order)
        .filter(Order.seller_id == seller_id)
        .order_by(Order.created_at.desc())
        .limit(5)
        .all()
    )

    recent_settlements = (
        db.query(Settlement)
        .filter(Settlement.seller_id == seller_id)
        .order_by(Settlement.year_month.desc())
        .limit(3)
        .all()
    )

    total_revenue = (
        db.query(func.sum(Order.total_amount))
        .filter(Order.seller_id == seller_id, Order.status == OrderStatus.DELIVERED)
        .scalar() or 0
    )

    return {
        "seller": {
            "id": seller.id,
            "email": seller.email,
            "full_name": seller.full_name,
            "company_name": seller.company_name,
            "business_number": seller.business_number,
            "is_active": seller.is_active,
            "joined_at": seller.joined_at.isoformat() if seller.joined_at else None,
        },
        **stats,
        "total_revenue": float(total_revenue),
        "products": [
            {"id": p.id, "name": p.name, "sku": p.sku, "storage_type": p.storage_type}
            for p in products
        ],
        "recent_orders": [
            {
                "order_number": o.order_number,
                "channel": o.channel,
                "status": o.status,
                "total_amount": float(o.total_amount),
                "created_at": o.created_at.isoformat(),
            }
            for o in recent_orders
        ],
        "recent_settlements": [
            {
                "year_month": s.year_month,
                "total_fee": float(s.total_fee),
                "status": s.status,
            }
            for s in recent_settlements
        ],
    }
