import csv
import io
from datetime import datetime
from decimal import Decimal, InvalidOperation
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models.user import User, UserRole
from backend.models.order import Order, OrderChannel, OrderStatus
from backend.models.sync_history import SyncHistory
from backend.core.dependencies import require_role

router = APIRouter(prefix="/channels", tags=["ChannelSync"])


def _generate_order_number(db: Session) -> str:
    today = datetime.now().strftime("%Y%m%d")
    prefix = f"FF-{today}-"
    last = (
        db.query(Order)
        .filter(Order.order_number.like(f"{prefix}%"))
        .order_by(Order.order_number.desc())
        .first()
    )
    seq = (int(last.order_number.rsplit("-", 1)[-1]) + 1) if last else 1
    return f"{prefix}{seq:04d}"


def _get_default_seller(db: Session) -> User:
    seller = db.query(User).filter(User.role == UserRole.SELLER).first()
    if not seller:
        raise HTTPException(status_code=400, detail="등록된 셀러가 없습니다.")
    return seller


def _sync(db: Session, rows: list[dict], channel: OrderChannel, seller_id: int) -> tuple[int, int, list[str]]:
    created = 0
    failed = 0
    errors = []
    for i, row in enumerate(rows, start=2):
        try:
            amount = Decimal(str(row.get("amount", "0")).replace(",", ""))
            o = Order(
                order_number=_generate_order_number(db),
                channel=channel,
                seller_id=seller_id,
                status=OrderStatus.RECEIVED,
                receiver_name=row["receiver_name"],
                receiver_phone=row["receiver_phone"],
                receiver_address=row["address"],
                total_amount=amount,
                note=row.get("note"),
            )
            db.add(o)
            db.flush()
            created += 1
        except Exception as e:
            failed += 1
            errors.append(f"행 {i}: {e}")
    return created, failed, errors


def _parse_and_sync(content: bytes, channel: OrderChannel, field_map: dict, db: Session) -> dict:
    seller = _get_default_seller(db)
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    rows = []
    for row in reader:
        mapped = {
            "receiver_name": row.get(field_map["receiver_name"], ""),
            "receiver_phone": row.get(field_map["receiver_phone"], ""),
            "address": row.get(field_map["address"], ""),
            "amount": row.get(field_map["amount"], "0"),
        }
        rows.append(mapped)

    created, failed, errors = _sync(db, rows, channel, seller.id)

    history = SyncHistory(
        channel=channel.value,
        order_count=created,
        success=failed == 0,
        error_message="; ".join(errors) if errors else None,
    )
    db.add(history)
    db.commit()
    return {"success_count": created, "fail_count": failed, "errors": errors}


# ── Field maps per channel ──────────────────────────────────────────────────────

SMARTSTORE_MAP = {"receiver_name": "수취인명", "receiver_phone": "수취인연락처", "address": "배송지", "amount": "결제금액"}
CAFE24_MAP     = {"receiver_name": "receiver_name", "receiver_phone": "receiver_phone", "address": "address", "amount": "total"}
OLIVEYOUNG_MAP = {"receiver_name": "수령인", "receiver_phone": "연락처", "address": "주소", "amount": "금액"}
ZIGZAG_MAP     = {"receiver_name": "name", "receiver_phone": "phone", "address": "address", "amount": "price"}


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/sync/smartstore")
async def sync_smartstore(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN])),
):
    return _parse_and_sync(await file.read(), OrderChannel.SMARTSTORE, SMARTSTORE_MAP, db)


@router.post("/sync/cafe24")
async def sync_cafe24(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN])),
):
    return _parse_and_sync(await file.read(), OrderChannel.CAFE24, CAFE24_MAP, db)


@router.post("/sync/oliveyoung")
async def sync_oliveyoung(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN])),
):
    return _parse_and_sync(await file.read(), OrderChannel.OLIVEYOUNG, OLIVEYOUNG_MAP, db)


@router.post("/sync/zigzag")
async def sync_zigzag(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN])),
):
    return _parse_and_sync(await file.read(), OrderChannel.ZIGZAG, ZIGZAG_MAP, db)


@router.get("/sync/history")
def sync_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN])),
):
    rows = db.query(SyncHistory).order_by(SyncHistory.synced_at.desc()).limit(50).all()
    return [
        {
            "id": r.id,
            "channel": r.channel,
            "synced_at": r.synced_at.isoformat(),
            "order_count": r.order_count,
            "success": r.success,
            "error_message": r.error_message,
        }
        for r in rows
    ]
