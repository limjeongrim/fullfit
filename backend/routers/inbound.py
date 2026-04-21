from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.core.dependencies import get_current_user
from backend.models.inbound import Inbound
from backend.models.inbound_schedule import InboundSchedule
from backend.models.inventory import Inventory
from backend.models.notification import Notification, NotificationType
from backend.models.product import Product
from backend.models.user import User, UserRole

router = APIRouter(prefix="/inbound", tags=["Inbound"])


def _notify(db: Session, user_id: int, ntype: NotificationType, title: str, message: str, related_id: int):
    db.add(Notification(
        user_id=user_id, type=ntype,
        title=title, message=message, related_id=related_id,
    ))


def _admins(db: Session):
    return db.query(User).filter(User.role == UserRole.ADMIN).all()


def _workers(db: Session):
    return db.query(User).filter(User.role == UserRole.WORKER).all()


def _inbound_or_404(db: Session, inbound_id: int) -> Inbound:
    obj = db.query(Inbound).filter(Inbound.id == inbound_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="입고 요청을 찾을 수 없습니다")
    return obj


# ── Admin: create inbound request (notifies seller) ─────────────────────────

@router.post("/request")
def create_inbound_request(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    product = db.query(Product).filter(Product.id == data["product_id"]).first()
    if not product:
        raise HTTPException(status_code=404, detail="상품을 찾을 수 없습니다")

    lot = data.get("lot_number") or f"LOT-{product.sku}-{date.today().strftime('%Y%m%d')}"
    expiry = date.fromisoformat(data["expiry_date"]) if data.get("expiry_date") else None

    inbound = Inbound(
        product_id=product.id,
        seller_id=product.seller_id,
        lot_number=lot,
        expiry_date=expiry,
        quantity=data["quantity"],
        inbound_date=date.today(),
        status="REQUESTED",
        note=data.get("note"),
        created_by=current_user.id,
    )
    db.add(inbound)
    db.flush()

    if product.seller_id:
        _notify(db, product.seller_id, NotificationType.INBOUND_REQUEST,
                "입고 요청이 도착했습니다",
                f"{product.name} {data['quantity']}개 입고 요청. 승인 또는 거절해주세요.",
                inbound.id)

    db.commit()
    db.refresh(inbound)
    return {"id": inbound.id, "status": inbound.status, "message": "입고 요청이 생성되었습니다. 셀러에게 알림을 보냈습니다."}


# ── Seller: list pending approval ────────────────────────────────────────────

@router.get("/pending-approval")
def get_pending_approval(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inbounds = (
        db.query(Inbound)
        .filter(Inbound.seller_id == current_user.id, Inbound.status == "REQUESTED")
        .order_by(Inbound.created_at.desc())
        .all()
    )
    result = []
    for i in inbounds:
        product = db.query(Product).filter(Product.id == i.product_id).first()
        result.append({
            "id": i.id,
            "product_name": product.name if product else "알 수 없음",
            "sku": product.sku if product else "",
            "quantity": i.quantity,
            "lot_number": i.lot_number,
            "expiry_date": str(i.expiry_date) if i.expiry_date else None,
            "requested_date": str(i.inbound_date),
            "note": i.note,
        })
    return result


# ── Seller: approve ───────────────────────────────────────────────────────────

@router.post("/{inbound_id}/approve")
def approve_inbound(
    inbound_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inbound = _inbound_or_404(db, inbound_id)
    inbound.status = "SELLER_APPROVED"

    for admin in _admins(db):
        _notify(db, admin.id, NotificationType.INBOUND_APPROVED,
                "입고 요청이 승인되었습니다",
                f"셀러가 입고 요청을 승인했습니다. 스케줄을 배정해주세요. (ID: {inbound_id})",
                inbound_id)

    db.commit()
    return {"success": True, "message": "승인 완료. 관리자에게 알림을 보냈습니다."}


# ── Seller: reject ────────────────────────────────────────────────────────────

@router.post("/{inbound_id}/reject")
def reject_inbound(
    inbound_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inbound = _inbound_or_404(db, inbound_id)
    reason = data.get("reason", "")
    inbound.status = "CANCELLED"
    inbound.note = f"거절 사유: {reason}"

    for admin in _admins(db):
        _notify(db, admin.id, NotificationType.INBOUND_REJECTED,
                "입고 요청이 거절되었습니다",
                f"셀러가 입고 요청을 거절했습니다. 사유: {reason}",
                inbound_id)

    db.commit()
    return {"success": True, "message": "거절 처리 완료"}


# ── Admin: list approved (awaiting schedule) ──────────────────────────────────

@router.get("/approved")
def get_approved_inbounds(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inbounds = (
        db.query(Inbound)
        .filter(Inbound.status == "SELLER_APPROVED")
        .order_by(Inbound.created_at.desc())
        .all()
    )
    result = []
    for i in inbounds:
        product = db.query(Product).filter(Product.id == i.product_id).first()
        seller  = db.query(User).filter(User.id == i.seller_id).first() if i.seller_id else None
        result.append({
            "id": i.id,
            "product_name": product.name if product else "알 수 없음",
            "sku": product.sku if product else "",
            "seller_name": (seller.company_name or seller.full_name) if seller else "—",
            "quantity": i.quantity,
            "lot_number": i.lot_number,
            "expiry_date": str(i.expiry_date) if i.expiry_date else None,
            "requested_date": str(i.inbound_date),
        })
    return result


# ── Admin: assign schedule ────────────────────────────────────────────────────

@router.post("/{inbound_id}/schedule")
def assign_schedule(
    inbound_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inbound = _inbound_or_404(db, inbound_id)
    inbound.status = "SCHEDULED"

    schedule = InboundSchedule(
        inbound_id=inbound_id,
        seller_id=inbound.seller_id,
        scheduled_date=date.fromisoformat(data["scheduled_date"]),
        time_slot=data["time_slot"],
        dock_number=data["dock_number"],
        status="SCHEDULED",
    )
    db.add(schedule)
    db.flush()

    msg = f"{data['scheduled_date']} {data['time_slot']} 도크{data['dock_number']} 입고 예정"
    for worker in _workers(db):
        _notify(db, worker.id, NotificationType.INBOUND_SCHEDULED,
                "새 입고 스케줄이 배정되었습니다", msg, inbound_id)

    if inbound.seller_id:
        _notify(db, inbound.seller_id, NotificationType.INBOUND_SCHEDULED,
                "입고 스케줄이 배정되었습니다", msg, inbound_id)

    db.commit()
    return {"success": True, "schedule_id": schedule.id}


# ── Worker: list today + next 2 days scheduled inbounds ──────────────────────

@router.get("/scheduled-upcoming")
def get_upcoming_scheduled(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today    = date.today()
    end_date = today + timedelta(days=2)

    schedules = (
        db.query(InboundSchedule)
        .filter(
            InboundSchedule.scheduled_date >= today,
            InboundSchedule.scheduled_date <= end_date,
            InboundSchedule.status.in_(["SCHEDULED", "COMPLETED"]),
        )
        .order_by(InboundSchedule.scheduled_date, InboundSchedule.time_slot)
        .all()
    )
    result = []
    for s in schedules:
        if not s.inbound_id:
            continue
        inbound = db.query(Inbound).filter(Inbound.id == s.inbound_id).first()
        if not inbound:
            continue
        product = db.query(Product).filter(Product.id == inbound.product_id).first()
        seller  = db.query(User).filter(User.id == inbound.seller_id).first() if inbound.seller_id else None
        result.append({
            "id": s.id,
            "inbound_id": inbound.id,
            "product_name": product.name if product else "알 수 없음",
            "sku": product.sku if product else "",
            "seller_name": (seller.company_name or seller.full_name) if seller else "—",
            "quantity": inbound.quantity,
            "lot_number": inbound.lot_number,
            "scheduled_date": str(s.scheduled_date),
            "time_slot": s.time_slot,
            "dock_number": s.dock_number,
            "status": s.status,
            "is_today": s.scheduled_date == today,
        })
    return result


# ── Worker: list today's scheduled inbounds (legacy) ─────────────────────────

@router.get("/today-scheduled")
def get_today_scheduled(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    schedules = (
        db.query(InboundSchedule)
        .filter(InboundSchedule.scheduled_date == today)
        .order_by(InboundSchedule.time_slot)
        .all()
    )
    result = []
    for s in schedules:
        inbound = db.query(Inbound).filter(Inbound.id == s.inbound_id).first() if s.inbound_id else None
        if not inbound or inbound.status not in ("SCHEDULED", "SELLER_APPROVED"):
            continue
        product = db.query(Product).filter(Product.id == inbound.product_id).first()
        result.append({
            "inbound_id": inbound.id,
            "schedule_id": s.id,
            "product_name": product.name if product else "알 수 없음",
            "sku": product.sku if product else "",
            "lot_number": inbound.lot_number,
            "quantity": inbound.quantity,
            "time_slot": s.time_slot,
            "dock_number": s.dock_number,
            "status": inbound.status,
        })
    return result


# ── Worker: confirm inbound (updates inventory) ───────────────────────────────

@router.post("/{inbound_id}/confirm")
def confirm_inbound(
    inbound_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inbound = _inbound_or_404(db, inbound_id)
    actual_qty = data.get("actual_quantity", inbound.quantity)

    inbound.status          = "COMPLETED"
    inbound.actual_quantity = actual_qty
    inbound.completed_date  = date.today()

    # Upsert inventory LOT row
    inv = (
        db.query(Inventory)
        .filter(Inventory.product_id == inbound.product_id,
                Inventory.lot_number  == inbound.lot_number)
        .first()
    )
    if inv:
        inv.quantity += actual_qty
        if inbound.expiry_date:
            inv.expiry_date = inbound.expiry_date
    else:
        inv = Inventory(
            product_id=inbound.product_id,
            lot_number=inbound.lot_number,
            expiry_date=inbound.expiry_date,
            quantity=actual_qty,
            inbound_date=date.today(),
        )
        db.add(inv)

    # Update linked schedule status
    schedule = db.query(InboundSchedule).filter(InboundSchedule.inbound_id == inbound_id).first()
    if schedule:
        schedule.status = "COMPLETED"

    for admin in _admins(db):
        _notify(db, admin.id, NotificationType.INBOUND_COMPLETED,
                "입고 완료",
                f"입고가 완료되어 재고에 반영되었습니다. ({actual_qty}개)",
                inbound_id)

    db.commit()
    return {"success": True, "message": f"{actual_qty}개 입고 완료. 재고에 반영되었습니다."}
