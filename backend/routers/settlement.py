import calendar
from datetime import datetime
from decimal import Decimal
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from backend.database import get_db
from backend.models.user import User, UserRole
from backend.models.product import Product
from backend.models.inventory import Inventory
from backend.models.inbound import Inbound
from backend.models.order import Order, OrderStatus
from backend.models.order_item import OrderItem
from backend.models.settlement import Settlement, SettlementStatus
from backend.schemas.settlement import SettlementGenerate, SettlementResponse
from backend.core.dependencies import get_current_user, require_role
from backend.core.notify import create_notification
from backend.models.notification import NotificationType

router = APIRouter()


def _to_response(s: Settlement) -> SettlementResponse:
    return SettlementResponse(
        id=s.id,
        seller_id=s.seller_id,
        seller_name=s.seller.full_name,
        year_month=s.year_month,
        storage_fee=s.storage_fee,
        inbound_fee=s.inbound_fee,
        outbound_fee=s.outbound_fee,
        extra_fee=s.extra_fee,
        total_fee=s.total_fee,
        status=s.status,
        confirmed_at=s.confirmed_at,
        created_at=s.created_at,
    )


@router.get("/settlements/", response_model=List[SettlementResponse])
def list_settlements(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN])),
):
    rows = (
        db.query(Settlement)
        .join(User, Settlement.seller_id == User.id)
        .order_by(Settlement.year_month.desc())
        .all()
    )
    return [_to_response(s) for s in rows]


@router.get("/settlements/seller", response_model=List[SettlementResponse])
def list_settlements_seller(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.SELLER])),
):
    rows = (
        db.query(Settlement)
        .filter(Settlement.seller_id == current_user.id)
        .order_by(Settlement.year_month.desc())
        .all()
    )
    return [_to_response(s) for s in rows]


@router.get("/settlements/{settlement_id}/detail")
def get_settlement_detail(
    settlement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    s = db.query(Settlement).filter(Settlement.id == settlement_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="정산을 찾을 수 없습니다.")
    if current_user.role == UserRole.SELLER and s.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다.")

    ym = s.year_month
    seller = db.query(User).filter(User.id == s.seller_id).first()
    year, month = map(int, ym.split("-"))
    days_in_month = calendar.monthrange(year, month)[1]
    period = f"{year}년 {month}월"

    # Outbound items: DELIVERED/SHIPPED orders in this month
    orders = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.product))
        .filter(
            Order.seller_id == s.seller_id,
            Order.status.in_([OrderStatus.DELIVERED, OrderStatus.SHIPPED]),
            func.strftime("%Y-%m", Order.updated_at) == ym,
        )
        .limit(30)
        .all()
    )
    outbound_items = []
    for o in orders:
        for item in o.items:
            outbound_items.append({
                "order_number": o.order_number,
                "product_name": item.product.name,
                "quantity": item.quantity,
                "unit_price": 900,
                "total": item.quantity * 900,
                "date": (o.updated_at.strftime("%Y-%m-%d") if o.updated_at else f"{ym}-01"),
            })

    # Storage items: current inventory per product
    products = db.query(Product).filter(Product.seller_id == s.seller_id).all()
    storage_items = []
    for p in products:
        inv = db.query(Inventory).filter(Inventory.product_id == p.id).first()
        if inv and inv.quantity > 0:
            unit = 50
            total = round(inv.quantity * days_in_month * unit / 1000)
            storage_items.append({
                "product_name": p.name,
                "avg_stock": inv.quantity,
                "days": days_in_month,
                "unit_price": unit,
                "total": total,
            })

    # Inbound items: records in this month
    inbound_records = (
        db.query(Inbound)
        .join(Product)
        .filter(
            Product.seller_id == s.seller_id,
            func.strftime("%Y-%m", Inbound.inbound_date) == ym,
        )
        .all()
    )
    inbound_items = []
    for inb in inbound_records:
        prod = db.query(Product).filter(Product.id == inb.product_id).first()
        inbound_items.append({
            "date": inb.inbound_date.strftime("%Y-%m-%d"),
            "product_name": prod.name if prod else "—",
            "quantity": inb.quantity,
            "type": "입고",
            "unit_price": 300,
            "total": inb.quantity * 300,
        })

    return {
        "seller_name": seller.full_name if seller else "—",
        "period": period,
        "summary": {
            "total": float(s.total_fee),
            "storage_fee": float(s.storage_fee),
            "inbound_fee": float(s.inbound_fee),
            "outbound_fee": float(s.outbound_fee),
            "extra_fee": float(s.extra_fee),
        },
        "status": s.status.value if hasattr(s.status, "value") else s.status,
        "outbound_items": outbound_items,
        "storage_items": storage_items,
        "inbound_items": inbound_items,
    }


@router.post("/settlements/generate", response_model=SettlementResponse)
def generate_settlement(
    data: SettlementGenerate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN])),
):
    seller = db.query(User).filter(User.id == data.seller_id).first()
    if not seller:
        raise HTTPException(status_code=404, detail="셀러를 찾을 수 없습니다.")

    if db.query(Settlement).filter(
        Settlement.seller_id == data.seller_id,
        Settlement.year_month == data.year_month,
    ).first():
        raise HTTPException(status_code=400, detail="해당 월 정산이 이미 존재합니다.")

    ym = data.year_month
    storage_count = (
        db.query(func.count(Inventory.id))
        .join(Product)
        .filter(Product.seller_id == data.seller_id)
        .scalar() or 0
    )
    storage_fee = Decimal(storage_count) * Decimal("500")

    inbound_count = (
        db.query(func.count(Inbound.id))
        .join(Product)
        .filter(
            Product.seller_id == data.seller_id,
            func.strftime("%Y-%m", Inbound.inbound_date) == ym,
        )
        .scalar() or 0
    )
    inbound_fee = Decimal(inbound_count) * Decimal("300")

    outbound_count = (
        db.query(func.count(Order.id))
        .filter(
            Order.seller_id == data.seller_id,
            Order.status == OrderStatus.DELIVERED,
            func.strftime("%Y-%m", Order.updated_at) == ym,
        )
        .scalar() or 0
    )
    outbound_fee = Decimal(outbound_count) * Decimal("1200")

    extra_fee = Decimal("0")
    total_fee = storage_fee + inbound_fee + outbound_fee + extra_fee

    s = Settlement(
        seller_id=data.seller_id,
        year_month=ym,
        storage_fee=storage_fee,
        inbound_fee=inbound_fee,
        outbound_fee=outbound_fee,
        extra_fee=extra_fee,
        total_fee=total_fee,
        status=SettlementStatus.DRAFT,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    s = db.query(Settlement).filter(Settlement.id == s.id).first()
    return _to_response(s)


@router.patch("/settlements/{settlement_id}/confirm", response_model=SettlementResponse)
def confirm_settlement(
    settlement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN])),
):
    s = db.query(Settlement).filter(Settlement.id == settlement_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="정산을 찾을 수 없습니다.")
    if s.status == SettlementStatus.CONFIRMED:
        raise HTTPException(status_code=400, detail="이미 확정된 정산입니다.")

    s.status = SettlementStatus.CONFIRMED
    s.confirmed_at = datetime.utcnow()
    create_notification(
        db, s.seller_id, NotificationType.SETTLEMENT_READY,
        f"{s.year_month} 정산 확정",
        f"{s.year_month} 정산이 확정되었습니다. 총 정산금액: ₩{int(s.total_fee):,}",
    )
    db.commit()
    db.refresh(s)
    s = db.query(Settlement).filter(Settlement.id == s.id).first()
    return _to_response(s)
