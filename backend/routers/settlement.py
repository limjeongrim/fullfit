from datetime import datetime
from decimal import Decimal
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models.user import User, UserRole
from backend.models.product import Product
from backend.models.inventory import Inventory
from backend.models.inbound import Inbound
from backend.models.order import Order, OrderStatus
from backend.models.settlement import Settlement, SettlementStatus
from backend.schemas.settlement import SettlementGenerate, SettlementResponse
from backend.core.dependencies import require_role

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

    ym = data.year_month  # "2026-03"

    # storage_fee: current inventory LOT count × 500
    storage_count = (
        db.query(func.count(Inventory.id))
        .join(Product)
        .filter(Product.seller_id == data.seller_id)
        .scalar() or 0
    )
    storage_fee = Decimal(storage_count) * Decimal("500")

    # inbound_fee: inbound records in this month × 300
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

    # outbound_fee: delivered orders in this month × 1200
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
    # reload with relationship
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
    db.commit()
    db.refresh(s)
    s = db.query(Settlement).filter(Settlement.id == s.id).first()
    return _to_response(s)
