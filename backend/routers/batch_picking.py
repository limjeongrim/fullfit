import json
from collections import defaultdict
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from backend.database import get_db
from backend.models.user import User, UserRole
from backend.models.order import Order, OrderStatus
from backend.models.order_item import OrderItem
from backend.models.product import Product
from backend.models.batch_picking import BatchPicking
from backend.core.dependencies import get_current_user, require_role

router = APIRouter()


# ── Algorithm ──────────────────────────────────────────────────────────────────

def create_batch_groups(orders: list[dict], max_batch_size: int = 5, max_items_per_batch: int = 20) -> list[list[dict]]:
    """
    Group orders into batches using SKU-overlap greedy heuristic.
    Orders with items are grouped by SKU overlap.
    Orders without items are grouped into plain size-capped batches.
    """
    if not orders:
        return []

    order_map = {o["order_id"]: o for o in orders}

    # Split by whether order has items
    with_items    = [o for o in orders if o["items"]]
    without_items = [o for o in orders if not o["items"]]

    batches: list[list[dict]] = []

    # ── SKU-overlap grouping for orders that have items ──────────────────────
    if with_items:
        order_skus = {o["order_id"]: set(i["sku"] for i in o["items"]) for o in with_items}
        order_qty  = {o["order_id"]: sum(i["qty"] for i in o["items"]) for o in with_items}
        unassigned = [o["order_id"] for o in with_items]

        while unassigned:
            def _overlap_score(oid):
                my_skus = order_skus[oid]
                return sum(1 for other in unassigned if other != oid and my_skus & order_skus[other])

            seed_id    = max(unassigned, key=_overlap_score)
            batch_ids  = [seed_id]
            unassigned.remove(seed_id)
            batch_skus  = set(order_skus[seed_id])
            batch_items = order_qty[seed_id]

            while len(batch_ids) < max_batch_size and unassigned:
                candidates = [
                    oid for oid in unassigned
                    if order_skus[oid] & batch_skus
                    and batch_items + order_qty[oid] <= max_items_per_batch
                ]
                if not candidates:
                    break
                next_id = max(candidates, key=lambda oid: len(order_skus[oid] & batch_skus))
                batch_ids.append(next_id)
                unassigned.remove(next_id)
                batch_skus  |= order_skus[next_id]
                batch_items += order_qty[next_id]

            batches.append([order_map[oid] for oid in batch_ids])

    # ── Plain size-capped batches for orders without items ───────────────────
    for i in range(0, len(without_items), max_batch_size):
        batches.append(without_items[i : i + max_batch_size])

    return batches


def _build_order_data(orders: list[Order]) -> list[dict]:
    result = []
    for o in orders:
        items = []
        for item in o.items:
            items.append({
                "product_id":   item.product_id,
                "product_name": item.product.name,
                "sku":          item.product.sku,
                "qty":          item.quantity,
            })
        result.append({
            "order_id":     o.id,
            "order_number": o.order_number,
            "items":        items,
        })
    return result


def _batch_to_response(batch: BatchPicking, db: Session) -> dict:
    order_ids = json.loads(batch.order_ids)
    orders = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.product))
        .filter(Order.id.in_(order_ids))
        .all()
    )

    orders_out = []
    sku_totals: dict[str, dict] = {}
    for o in orders:
        items = []
        for item in o.items:
            items.append({
                "product_name": item.product.name,
                "sku":          item.product.sku,
                "qty":          item.quantity,
            })
            key = item.product.sku
            if key not in sku_totals:
                sku_totals[key] = {"sku": key, "product_name": item.product.name, "total_qty": 0}
            sku_totals[key]["total_qty"] += item.quantity
        orders_out.append({"order_id": o.id, "order_number": o.order_number, "items": items})

    # Overlap rate: (total sku lines - unique SKUs) / total sku lines
    total_lines = sum(len(o["items"]) for o in orders_out)
    unique_skus  = len(sku_totals)
    overlap_pct  = round((total_lines - unique_skus) / max(total_lines, 1) * 100)

    return {
        "id":           batch.id,
        "batch_number": batch.batch_number,
        "status":       batch.status,
        "order_count":  len(order_ids),
        "total_items":  batch.total_items,
        "orders":       orders_out,
        "sku_summary":  list(sku_totals.values()),
        "overlap_rate": f"{overlap_pct}% 중복 절감",
        "assigned_worker": batch.assigned_worker.full_name if batch.assigned_worker else None,
        "created_at":   batch.created_at.isoformat(),
        "completed_at": batch.completed_at.isoformat() if batch.completed_at else None,
    }


def _get_batched_order_ids(db: Session) -> set[int]:
    """Return order IDs already assigned to CREATED/IN_PROGRESS batches."""
    active = db.query(BatchPicking).filter(
        BatchPicking.status.in_(["CREATED", "IN_PROGRESS"])
    ).all()
    batched: set[int] = set()
    for b in active:
        try:
            batched.update(json.loads(b.order_ids))
        except Exception:
            pass
    return batched


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/batch-picking/generate")
def generate_batches(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Clear CREATED batches, then re-group all RECEIVED orders into optimised batches."""
    # Delete stale CREATED batches (they haven't started yet — safe to replace)
    db.query(BatchPicking).filter(BatchPicking.status == "CREATED").delete(synchronize_session=False)
    db.commit()

    received = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.product))
        .filter(Order.status == OrderStatus.RECEIVED)
        .all()
    )
    if not received:
        return {"created": 0, "batches": [], "message": "처리할 RECEIVED 주문이 없습니다."}

    order_data = _build_order_data(received)
    groups     = create_batch_groups(order_data)

    today_str = datetime.now().strftime("%Y%m%d")
    seq_base  = 0  # always restart from 001 after clearing

    created_batches = []
    total_individual = len(received)  # trips without batching
    total_batch_trips = 0

    for i, group in enumerate(groups, start=seq_base + 1):
        batch_number = f"BP-{today_str}-{i:03d}"
        total_items  = sum(sum(it["qty"] for it in o["items"]) for o in group)
        order_ids    = [o["order_id"] for o in group]

        bp = BatchPicking(
            batch_number=batch_number,
            status="CREATED",
            order_ids=json.dumps(order_ids),
            total_items=total_items,
        )
        db.add(bp)
        db.flush()
        total_batch_trips += 1
        created_batches.append(_batch_to_response(bp, db))

    db.commit()

    trips_saved = total_individual - total_batch_trips
    return {
        "created":      len(groups),
        "order_count":  total_individual,
        "trips_saved":  trips_saved,
        "message":      f"RECEIVED 주문 {total_individual}건을 {len(groups)}배치로 묶었습니다. 예상 이동 절감: {trips_saved}회",
        "batches":      created_batches,
    }


@router.get("/batch-picking/list")
def list_batches(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    batches = (
        db.query(BatchPicking)
        .options(joinedload(BatchPicking.assigned_worker))
        .filter(BatchPicking.status.in_(["CREATED", "IN_PROGRESS"]))
        .order_by(BatchPicking.created_at.desc())
        .all()
    )
    return [_batch_to_response(b, db) for b in batches]


@router.post("/batch-picking/{batch_id}/start")
def start_batch(
    batch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    batch = db.query(BatchPicking).filter(BatchPicking.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="배치를 찾을 수 없습니다.")
    if batch.status != "CREATED":
        raise HTTPException(status_code=400, detail="이미 시작되었거나 완료된 배치입니다.")

    batch.status             = "IN_PROGRESS"
    batch.assigned_worker_id = current_user.id

    # Move all orders in batch to PICKING
    order_ids = json.loads(batch.order_ids)
    db.query(Order).filter(
        Order.id.in_(order_ids),
        Order.status == OrderStatus.RECEIVED,
    ).update({"status": OrderStatus.PICKING, "updated_at": datetime.utcnow()}, synchronize_session=False)

    db.commit()
    db.refresh(batch)
    return _batch_to_response(batch, db)


@router.post("/batch-picking/{batch_id}/complete")
def complete_batch(
    batch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    batch = db.query(BatchPicking).filter(BatchPicking.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="배치를 찾을 수 없습니다.")
    if batch.status == "COMPLETED":
        raise HTTPException(status_code=400, detail="이미 완료된 배치입니다.")

    batch.status       = "COMPLETED"
    batch.completed_at = datetime.utcnow()
    if not batch.assigned_worker_id:
        batch.assigned_worker_id = current_user.id

    db.commit()
    db.refresh(batch)
    return _batch_to_response(batch, db)


@router.get("/batch-picking/stats")
def batch_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = str(date.today())

    pending_count = (
        db.query(func.count(BatchPicking.id))
        .filter(BatchPicking.status.in_(["CREATED", "IN_PROGRESS"]))
        .scalar() or 0
    )
    today_completed = (
        db.query(BatchPicking)
        .filter(
            BatchPicking.status == "COMPLETED",
            func.date(BatchPicking.completed_at) == today,
        )
        .all()
    )
    completed_count = len(today_completed)

    # Trips saved = sum of (order_count - 1) for each completed batch today
    trips_saved = 0
    for b in today_completed:
        try:
            trips_saved += max(len(json.loads(b.order_ids)) - 1, 0)
        except Exception:
            pass

    # Pending trips saved estimate (CREATED + IN_PROGRESS)
    pending_batches = (
        db.query(BatchPicking)
        .filter(BatchPicking.status.in_(["CREATED", "IN_PROGRESS"]))
        .all()
    )
    pending_trips_saved = 0
    for b in pending_batches:
        try:
            pending_trips_saved += max(len(json.loads(b.order_ids)) - 1, 0)
        except Exception:
            pass

    return {
        "pending_count":       pending_count,
        "today_completed":     completed_count,
        "trips_saved_today":   trips_saved,
        "pending_trips_saved": pending_trips_saved,
    }
