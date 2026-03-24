from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func as sqlfunc
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.user import User, UserRole
from backend.models.inbound import Inbound
from backend.models.inbound_schedule import InboundSchedule
from backend.models.inventory import Inventory
from backend.models.demand_history import DemandHistory
from backend.models.promotion import Promotion
from backend.models.product import Product
from backend.models.notification import NotificationType
from backend.core.dependencies import get_current_user, require_role
from backend.core.notify import create_notification

router = APIRouter()

TIME_SLOTS = [
    "09:00-10:00", "10:00-11:00", "11:00-12:00",
    "14:00-15:00", "15:00-16:00", "16:00-17:00",
]
DOCKS = [1, 2]
SLOTS_PER_DAY = len(TIME_SLOTS) * len(DOCKS)  # 12


# ── Priority helpers ─────────────────────────────────────────────────────────

def _days_of_stock(db: Session, product_id: int) -> float:
    total_stock = (
        db.query(sqlfunc.sum(Inventory.quantity))
        .filter(Inventory.product_id == product_id)
        .scalar() or 0
    )
    cutoff = date.today() - timedelta(days=30)
    total_sold = (
        db.query(sqlfunc.sum(DemandHistory.quantity_sold))
        .filter(DemandHistory.product_id == product_id, DemandHistory.date >= cutoff)
        .scalar() or 0
    )
    daily_demand = total_sold / 30
    if daily_demand <= 0:
        return 999.0
    return round(total_stock / daily_demand, 1)


def _has_upcoming_promotion(db: Session, product_id: int, within_days: int = 7) -> bool:
    today = date.today()
    end   = today + timedelta(days=within_days)
    return (
        db.query(Promotion)
        .filter(
            Promotion.is_active == True,
            Promotion.start_date <= end,
            Promotion.end_date   >= today,
        )
        .first()
    ) is not None


def _past_inbound_count(db: Session, seller_id: int) -> int:
    return db.query(Inbound).filter(Inbound.created_by == seller_id).count()


def calculate_priority_score(inbound: Inbound, db: Session) -> tuple[float, str]:
    score   = 0.0
    reasons = []

    dos = _days_of_stock(db, inbound.product_id)
    if dos < 7:
        score += 30
        reasons.append(f"재고 {dos:.0f}일치 남음(긴급)")
    elif dos < 14:
        score += 20
        reasons.append(f"재고 {dos:.0f}일치 남음(주의)")

    if _has_upcoming_promotion(db, inbound.product_id, 7):
        score += 20
        reasons.append("7일 내 프로모션 예정")

    days_since = (datetime.utcnow() - inbound.created_at).days
    if days_since >= 2:
        score += 15
        reasons.append(f"요청 {days_since}일 경과")

    if inbound.quantity > 100:
        score += 10
        reasons.append(f"대량 {inbound.quantity}개")

    if _past_inbound_count(db, inbound.created_by) > 10:
        score += 5
        reasons.append("장기 거래 셀러")

    return round(score, 1), (" / ".join(reasons) if reasons else "일반 입고")


# ── Slot assignment ──────────────────────────────────────────────────────────

def assign_time_slots(
    scored: list[tuple],   # [(inbound, score, reason), ...]
    target_date: date,
    db: Session,
) -> tuple[list, list]:
    """Returns ([(InboundSchedule, Inbound), ...], overflow_inbounds)."""
    existing = (
        db.query(InboundSchedule)
        .filter(
            InboundSchedule.scheduled_date == target_date,
            InboundSchedule.status != "CANCELLED",
        )
        .all()
    )
    occupied: set[tuple] = {(s.time_slot, s.dock_number) for s in existing}

    sorted_reqs = sorted(scored, key=lambda x: -x[1])
    scheduled, overflow = [], []

    for inbound, score, reason in sorted_reqs:
        is_large  = inbound.quantity > 100
        dock_pref = [2, 1] if is_large else [1, 2]
        assigned  = False

        for slot in TIME_SLOTS:
            for dock in dock_pref:
                if (slot, dock) not in occupied:
                    occupied.add((slot, dock))
                    entry = InboundSchedule(
                        inbound_id      = inbound.id,
                        seller_id       = inbound.created_by,
                        scheduled_date  = target_date,
                        time_slot       = slot,
                        dock_number     = dock,
                        priority_score  = score,
                        priority_reason = reason,
                        status          = "SCHEDULED",
                    )
                    scheduled.append((entry, inbound))
                    assigned = True
                    break
            if assigned:
                break

        if not assigned:
            overflow.append(inbound)

    return scheduled, overflow


# ── Response helper ──────────────────────────────────────────────────────────

def _sched_dict(sched: InboundSchedule, inbound: Inbound, db: Session) -> dict:
    seller  = db.query(User).filter(User.id == sched.seller_id).first()
    product = db.query(Product).filter(Product.id == inbound.product_id).first()
    return {
        "id":              sched.id,
        "inbound_id":      sched.inbound_id,
        "time_slot":       sched.time_slot,
        "dock_number":     sched.dock_number,
        "seller_name":     seller.full_name if seller else "—",
        "seller_id":       sched.seller_id,
        "product_name":    product.name if product else "—",
        "product_sku":     product.sku  if product else "—",
        "lot_number":      inbound.lot_number,
        "total_units":     inbound.quantity,
        "priority_score":  sched.priority_score,
        "priority_reason": sched.priority_reason,
        "status":          sched.status,
        "scheduled_date":  sched.scheduled_date.isoformat(),
        "created_at":      sched.created_at.isoformat(),
    }


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/inbound-schedule/generate")
def generate_schedule(
    target_date: Optional[date] = Query(None, description="YYYY-MM-DD, default=tomorrow"),
    db: Session  = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN])),
):
    if not target_date:
        target_date = date.today() + timedelta(days=1)

    # Already-scheduled inbound IDs (any status except CANCELLED)
    already_scheduled_ids = {
        r[0] for r in
        db.query(InboundSchedule.inbound_id)
        .filter(InboundSchedule.status != "CANCELLED")
        .all()
        if r[0] is not None
    }

    # All unscheduled inbounds (no date cutoff — scheduling can catch up on older requests too)
    pending = db.query(Inbound).order_by(Inbound.created_at.desc()).all()
    pending = [i for i in pending if i.id not in already_scheduled_ids]

    if not pending:
        existing_today = (
            db.query(InboundSchedule)
            .filter(
                InboundSchedule.scheduled_date == target_date,
                InboundSchedule.status != "CANCELLED",
            )
            .all()
        )
        return {
            "date":             target_date.isoformat(),
            "total_requests":   0,
            "slots_used":       len(existing_today),
            "slots_available":  max(0, SLOTS_PER_DAY - len(existing_today)),
            "schedule":         [],
            "overflow":         [],
            "message":          "스케줄 대기 중인 입고 요청이 없습니다.",
        }

    scored = [(i, *calculate_priority_score(i, db)) for i in pending]
    scheduled_entries, overflow = assign_time_slots(scored, target_date, db)

    for entry, _ in scheduled_entries:
        db.add(entry)
    db.commit()
    for entry, _ in scheduled_entries:
        db.refresh(entry)

    # Notify sellers
    for entry, inbound in scheduled_entries:
        create_notification(
            db,
            inbound.created_by,
            NotificationType.ORDER_RECEIVED,
            "입고 시간대 배정",
            f"입고 시간대가 배정되었습니다: {target_date} {entry.time_slot} (도크 {entry.dock_number}번)",
        )
    db.commit()

    # Count all slots used for this date
    slots_used = (
        db.query(InboundSchedule)
        .filter(
            InboundSchedule.scheduled_date == target_date,
            InboundSchedule.status != "CANCELLED",
        )
        .count()
    )

    return {
        "date":            target_date.isoformat(),
        "total_requests":  len(pending),
        "slots_used":      slots_used,
        "slots_available": max(0, SLOTS_PER_DAY - slots_used),
        "schedule":        [_sched_dict(e, i, db) for e, i in scheduled_entries],
        "overflow":        [
            {
                "inbound_id": i.id,
                "lot_number": i.lot_number,
                "quantity":   i.quantity,
                "seller_id":  i.created_by,
                "reason":     "오늘 모든 슬롯 마감",
            }
            for i in overflow
        ],
    }


@router.get("/inbound-schedule/list")
def list_schedule(
    target_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    db:           Session       = Depends(get_db),
    current_user: User          = Depends(require_role([UserRole.ADMIN])),
):
    today    = date.today()
    tomorrow = today + timedelta(days=1)

    if target_date:
        try:
            query_date = date.fromisoformat(target_date)
        except ValueError:
            query_date = today
        dates = [query_date]
    else:
        dates = [today, tomorrow]

    result = {}
    for d in dates:
        rows = (
            db.query(InboundSchedule)
            .filter(
                InboundSchedule.scheduled_date == d,
                InboundSchedule.status != "CANCELLED",
            )
            .order_by(InboundSchedule.time_slot, InboundSchedule.dock_number)
            .all()
        )
        result[d.isoformat()] = [
            _sched_dict(s, s.inbound, db) for s in rows if s.inbound
        ]

    return {
        "dates":           [d.isoformat() for d in dates],
        "slots_per_day":   SLOTS_PER_DAY,
        "time_slots":      TIME_SLOTS,
        "schedules":       result,
    }


@router.post("/inbound-schedule/{schedule_id}/confirm")
def confirm_schedule(
    schedule_id:  int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    sched = db.query(InboundSchedule).filter(InboundSchedule.id == schedule_id).first()
    if not sched:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="스케줄을 찾을 수 없습니다.")

    if current_user.role == UserRole.SELLER and sched.seller_id != current_user.id:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="본인의 스케줄만 확정할 수 있습니다.")

    sched.status = "CONFIRMED"
    db.commit()

    # Notify admin and seller
    from backend.models.user import UserRole as _Role
    admins = db.query(User).filter(User.role == _Role.ADMIN).all()
    seller = db.query(User).filter(User.id == sched.seller_id).first()
    for admin in admins:
        create_notification(
            db, admin.id, NotificationType.INBOUND_SCHEDULED,
            "입고 확정",
            f"{seller.full_name if seller else '셀러'}가 {sched.scheduled_date} {sched.time_slot} 입고를 확정했습니다.",
        )
    if seller:
        create_notification(
            db, seller.id, NotificationType.INBOUND_SCHEDULED,
            "입고 일정 확정",
            f"{sched.scheduled_date} {sched.time_slot} 입고 일정이 확정되었습니다.",
        )
    db.commit()

    return {"changed": True, "status": "CONFIRMED", "schedule_id": schedule_id}


@router.post("/inbound-schedule/{schedule_id}/cancel")
def cancel_schedule(
    schedule_id:  int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(require_role([UserRole.ADMIN])),
):
    sched = db.query(InboundSchedule).filter(InboundSchedule.id == schedule_id).first()
    if not sched:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="스케줄을 찾을 수 없습니다.")

    prev_date = sched.scheduled_date
    sched.status = "CANCELLED"
    db.commit()

    # Notify seller
    create_notification(
        db, sched.seller_id, NotificationType.ORDER_RECEIVED,
        "입고 스케줄 취소",
        f"{prev_date} {sched.time_slot} 입고 스케줄이 취소되었습니다. 새 시간대가 배정될 예정입니다.",
    )
    db.commit()

    return {"changed": True, "status": "CANCELLED", "schedule_id": schedule_id}


@router.get("/inbound-schedule/seller/{seller_id}")
def seller_schedule(
    seller_id:    int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    if current_user.role == UserRole.SELLER and current_user.id != seller_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="본인의 스케줄만 조회할 수 있습니다.")

    today = date.today()
    rows  = (
        db.query(InboundSchedule)
        .filter(
            InboundSchedule.seller_id      == seller_id,
            InboundSchedule.scheduled_date >= today,
            InboundSchedule.status         != "CANCELLED",
        )
        .order_by(InboundSchedule.scheduled_date, InboundSchedule.time_slot)
        .all()
    )
    return [_sched_dict(s, s.inbound, db) for s in rows if s.inbound]
