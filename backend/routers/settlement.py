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
from backend.models.return_request import ReturnRequest
from backend.models.settlement import Settlement, SettlementStatus
from backend.schemas.settlement import SettlementGenerate, SettlementResponse
from backend.core.dependencies import get_current_user, require_role
from backend.core.notify import create_notification
from backend.models.notification import NotificationType

router = APIRouter()

CHANNEL_FEE_RATES = {
    "SMARTSTORE": 0.033,
    "CAFE24":     0.020,
    "OLIVEYOUNG": 0.250,
    "ZIGZAG":     0.100,
    "MANUAL":     0.0,
}


def calculate_settlement(seller_id: int, ym: str, db: Session) -> dict:
    # Include both SHIPPED and DELIVERED; match on created_at OR updated_at
    orders = (
        db.query(Order)
        .filter(
            Order.seller_id == seller_id,
            Order.status.in_([OrderStatus.DELIVERED, OrderStatus.SHIPPED]),
            func.strftime("%Y-%m", Order.created_at) == ym,
        )
        .all()
    )
    # Fallback: also capture orders whose updated_at falls in the period but created_at doesn't
    existing_ids = {o.id for o in orders}
    extra_q = (
        db.query(Order)
        .filter(
            Order.seller_id == seller_id,
            Order.status.in_([OrderStatus.DELIVERED, OrderStatus.SHIPPED]),
            func.strftime("%Y-%m", Order.updated_at) == ym,
        )
    )
    if existing_ids:
        extra_q = extra_q.filter(Order.id.notin_(existing_ids))
    orders = orders + extra_q.all()

    print(f"[Settlement] seller_id={seller_id}, period={ym}, orders found={len(orders)}")
    for o in orders[:3]:
        print(f"  order={o.order_number}, status={o.status}, amount={o.total_amount}, created={o.created_at}")

    total_sales = 0.0
    total_channel_fee = 0.0
    total_shipping_fee = 0.0

    for order in orders:
        total_sales += float(order.total_amount or 0)
        channel_key = str(order.channel).split(".")[-1]  # handle both "SMARTSTORE" and "OrderChannel.SMARTSTORE"
        rate = CHANNEL_FEE_RATES.get(channel_key, 0.033)
        total_channel_fee += float(order.total_amount or 0) * rate

        items = db.query(OrderItem).filter(OrderItem.order_id == order.id).all()
        item_count = sum(it.quantity for it in items)
        total_shipping_fee += min(800 + max(0, item_count - 1) * 200, 2000)

    print(f"[Settlement] total_sales={total_sales}, channel_fee={total_channel_fee}, shipping_fee={total_shipping_fee}")

    # Storage fee: 5,000원 per product type (not per unit)
    inventories = (
        db.query(Inventory)
        .join(Product, Product.id == Inventory.product_id)
        .filter(Product.seller_id == seller_id)
        .all()
    )
    total_storage_fee = len(inventories) * 5000

    # Return processing fee: 1,500원 per return
    return_count = (
        db.query(func.count(ReturnRequest.id))
        .filter(
            ReturnRequest.seller_id == seller_id,
            func.strftime("%Y-%m", ReturnRequest.created_at) == ym,
        )
        .scalar() or 0
    )
    total_return_fee = return_count * 1500

    # If no sales, zero out all fees
    if total_sales == 0:
        total_channel_fee = 0
        total_shipping_fee = 0
        total_storage_fee = 0
        total_return_fee = 0

    total_deduction = total_channel_fee + total_shipping_fee + total_storage_fee + total_return_fee
    final_amount = max(0, total_sales - total_deduction)

    print(f"[Settlement] storage_fee={total_storage_fee}, return_fee={total_return_fee}, final={final_amount}")

    return {
        "total_sales":    round(total_sales),
        "channel_fee":    round(total_channel_fee),
        "storage_fee":    round(total_storage_fee),
        "outbound_fee":   round(total_shipping_fee),
        "extra_fee":      round(total_return_fee),
        "inbound_fee":    0,
        "total_fee":      round(final_amount),
        "order_count":    len(orders),
        "return_count":   return_count,
    }


def _to_response(s: Settlement) -> SettlementResponse:
    return SettlementResponse(
        id=s.id,
        seller_id=s.seller_id,
        seller_name=s.seller.full_name,
        year_month=s.year_month,
        total_sales=s.total_sales or Decimal(0),
        channel_fee=s.channel_fee or Decimal(0),
        storage_fee=s.storage_fee,
        outbound_fee=s.outbound_fee,
        extra_fee=s.extra_fee,
        inbound_fee=s.inbound_fee,
        total_fee=s.total_fee,
        order_count=s.order_count or 0,
        return_count=s.return_count or 0,
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

    # Outbound orders with per-order shipping fee
    orders = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.product))
        .filter(
            Order.seller_id == s.seller_id,
            Order.status == OrderStatus.DELIVERED,
            func.strftime("%Y-%m", Order.created_at) == ym,
        )
        .limit(50)
        .all()
    )
    outbound_items = []
    for o in orders:
        item_count = sum(it.quantity for it in o.items)
        fee = 800 + max(0, item_count - 1) * 200
        for item in o.items:
            outbound_items.append({
                "order_number": o.order_number,
                "product_name": item.product.name,
                "quantity": item.quantity,
                "channel": o.channel,
                "unit_price": fee,
                "total": fee,
                "date": (o.created_at.strftime("%Y-%m-%d") if o.created_at else f"{ym}-01"),
            })

    # Channel fee per order
    channel_items = []
    for o in orders:
        rate = CHANNEL_FEE_RATES.get(o.channel, 0.033)
        fee = round(float(o.total_amount or 0) * rate)
        channel_items.append({
            "order_number": o.order_number,
            "channel": o.channel,
            "sales_amount": float(o.total_amount or 0),
            "rate_pct": round(rate * 100, 1),
            "fee": fee,
            "date": (o.created_at.strftime("%Y-%m-%d") if o.created_at else f"{ym}-01"),
        })

    # Storage items: current inventory per product @ 100/unit
    products = db.query(Product).filter(Product.seller_id == s.seller_id).all()
    storage_items = []
    for p in products:
        inv = db.query(Inventory).filter(Inventory.product_id == p.id).first()
        if inv and inv.quantity > 0:
            total = inv.quantity * 100
            storage_items.append({
                "product_name": p.name,
                "avg_stock": inv.quantity,
                "unit_price": 100,
                "total": total,
            })

    # Inbound items (informational)
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
            "unit_price": 0,
            "total": 0,
        })

    total_sales  = float(s.total_sales or 0)
    channel_fee  = float(s.channel_fee or 0)
    storage_fee  = float(s.storage_fee or 0)
    outbound_fee = float(s.outbound_fee or 0)
    return_fee   = float(s.extra_fee or 0)
    final_amount = float(s.total_fee or 0)
    total_deduction = channel_fee + outbound_fee + storage_fee + return_fee

    return {
        "seller_name": seller.full_name if seller else "—",
        "period": period,
        "summary": {
            "total_sales":     total_sales,
            "channel_fee":     channel_fee,
            "outbound_fee":    outbound_fee,
            "storage_fee":     storage_fee,
            "return_fee":      return_fee,
            "total_deduction": total_deduction,
            "final_amount":    final_amount,
            "order_count":     s.order_count or 0,
            "return_count":    s.return_count or 0,
            # legacy compat
            "total":           final_amount,
            "inbound_fee":     0,
            "extra_fee":       return_fee,
        },
        "status": s.status.value if hasattr(s.status, "value") else s.status,
        "outbound_items": outbound_items,
        "channel_items":  channel_items,
        "storage_items":  storage_items,
        "inbound_items":  inbound_items,
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

    calc = calculate_settlement(data.seller_id, data.year_month, db)

    s = Settlement(
        seller_id=data.seller_id,
        year_month=data.year_month,
        total_sales=Decimal(str(calc["total_sales"])),
        channel_fee=Decimal(str(calc["channel_fee"])),
        storage_fee=Decimal(str(calc["storage_fee"])),
        outbound_fee=Decimal(str(calc["outbound_fee"])),
        extra_fee=Decimal(str(calc["extra_fee"])),
        inbound_fee=Decimal("0"),
        total_fee=Decimal(str(calc["total_fee"])),
        order_count=calc["order_count"],
        return_count=calc["return_count"],
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
        f"{s.year_month} 정산이 확정되었습니다. 최종 정산금액: ₩{int(s.total_fee):,}",
    )
    db.commit()
    db.refresh(s)
    s = db.query(Settlement).filter(Settlement.id == s.id).first()
    return _to_response(s)
