from datetime import datetime, date, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy import func as sqlfunc
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models.user import User, UserRole
from backend.models.product import Product
from backend.models.inventory import Inventory
from backend.models.order import Order, OrderStatus
from backend.models.order_item import OrderItem
from backend.models.demand_history import DemandHistory
from backend.models.slotting_log import SlottingLog
from backend.core.dependencies import get_current_user, require_role

router = APIRouter()

ZONE_COLS = 5          # columns per zone
MAX_ROWS  = 10         # max rows per zone


# ── Algorithm ──────────────────────────────────────────────────────────────────

def _turnover_data(db: Session) -> dict[int, dict]:
    """
    Returns {product_id: {turnover_rate, total_sold_30d, avg_stock}} for all active products.
    turnover = total_sold_last_30d / max(current_stock, 1)
    """
    cutoff = date.today() - timedelta(days=30)

    # Sales from demand_history (last 30 days)
    sales_rows = (
        db.query(DemandHistory.product_id, sqlfunc.sum(DemandHistory.quantity_sold))
        .filter(DemandHistory.date >= cutoff)
        .group_by(DemandHistory.product_id)
        .all()
    )
    sales_map = {r[0]: (r[1] or 0) for r in sales_rows}

    # Current stock per product
    stock_rows = (
        db.query(Inventory.product_id, sqlfunc.sum(Inventory.quantity))
        .group_by(Inventory.product_id)
        .all()
    )
    stock_map = {r[0]: (r[1] or 0) for r in stock_rows}

    # Co-occurrence: count orders where each product_id pair appears together
    # (used for adjacent-col placement)
    cooc: dict[int, dict[int, int]] = {}
    thirty_ago = datetime.utcnow() - timedelta(days=30)
    order_ids = [
        r[0] for r in
        db.query(OrderItem.order_id)
        .join(Order)
        .filter(Order.created_at >= thirty_ago, Order.status != OrderStatus.CANCELLED)
        .distinct()
        .all()
    ]
    for oid in order_ids:
        pids = [r[0] for r in db.query(OrderItem.product_id).filter(OrderItem.order_id == oid).all()]
        for p1 in pids:
            for p2 in pids:
                if p1 != p2:
                    cooc.setdefault(p1, {}).setdefault(p2, 0)
                    cooc[p1][p2] += 1

    result = {}
    for pid in sales_map.keys() | stock_map.keys():
        sold  = sales_map.get(pid, 0)
        stock = stock_map.get(pid, 0)
        result[pid] = {
            "total_sold_30d": sold,
            "current_stock":  stock,
            "turnover_rate":  round(sold / max(stock, 1), 4),
            "top_cooc":       max(cooc.get(pid, {}).items(), key=lambda x: x[1])[0]
                              if cooc.get(pid) else None,
        }
    return result


def _abc_classify(products: list, turnover: dict[int, dict]) -> list[dict]:
    """
    ABC classification by turnover rate:
      A-class: top 20%   → Zone A
      B-class: next 30%  → Zone B
      C-class: bottom 50%→ Zone C
      cold storage       → Zone D (regardless of class)
    """
    from backend.models.product import StorageType

    active = [p for p in products if p.is_active]
    if not active:
        return []

    rated = sorted(active, key=lambda p: turnover.get(p.id, {}).get("turnover_rate", 0), reverse=True)
    n = len(rated)
    a_cut = max(1, round(n * 0.20))
    b_cut = max(1, round(n * 0.50))   # top 20%+30% = top 50%

    classified = []
    for i, p in enumerate(rated):
        t = turnover.get(p.id, {})
        is_cold = p.storage_type.value == "COLD" if hasattr(p.storage_type, "value") else p.storage_type == "COLD"

        if is_cold:
            abc = "D"
            zone = "D"
        elif i < a_cut:
            abc = "A"
            zone = "A"
        elif i < b_cut:
            abc = "B"
            zone = "B"
        else:
            abc = "C"
            zone = "C"

        classified.append({
            "product_id":     p.id,
            "product_name":   p.name,
            "sku":            p.sku,
            "abc_class":      abc,
            "recommended_zone": zone,
            "turnover_rate":  t.get("turnover_rate", 0),
            "total_sold_30d": t.get("total_sold_30d", 0),
            "current_stock":  t.get("current_stock", 0),
            "top_cooc":       t.get("top_cooc"),
            "current_zone":   p.warehouse_zone or "B",
            "current_row":    p.warehouse_row  or 1,
            "current_col":    p.warehouse_col  or 1,
            "current_location": p.location_code or f"{p.warehouse_zone or 'B'}-01-01",
            "storage_type":   "COLD" if is_cold else "ROOM_TEMP",
        })
    return classified


def _assign_locations(classified: list[dict]) -> list[dict]:
    """
    Within each zone, assign row/col:
      - Higher turnover → lower row (closer to entrance)
      - Co-located products (top_cooc) → try adjacent cols
    """
    from collections import defaultdict
    zone_buckets: dict[str, list] = defaultdict(list)
    for item in classified:
        zone_buckets[item["recommended_zone"]].append(item)

    for zone, items in zone_buckets.items():
        # Sort by turnover DESC (ties broken by top_cooc preference)
        sorted_items = sorted(items, key=lambda x: -x["turnover_rate"])

        # Simple co-location pass: if an item's top co-occurrence partner
        # is in the same zone, swap them adjacent
        placed = []
        used_positions: set[tuple] = set()

        def _next_slot(after_col=None) -> tuple[int, int]:
            """Return next available (row, col) in snake order."""
            for row in range(1, MAX_ROWS + 1):
                for col in range(1, ZONE_COLS + 1):
                    if (row, col) not in used_positions:
                        return row, col
            return (MAX_ROWS, ZONE_COLS)   # overflow fallback

        for item in sorted_items:
            # Try to place adjacent to co-occurrence partner if already placed
            cooc_id = item.get("top_cooc")
            placed_cooc = next((p for p in placed if p["product_id"] == cooc_id), None)

            if placed_cooc:
                cr, cc = placed_cooc["_rec_row"], placed_cooc["_rec_col"]
                adjacent = [(cr, cc + 1), (cr, cc - 1), (cr + 1, 1)]
                slot = next(((r, c) for r, c in adjacent if 1 <= r <= MAX_ROWS and 1 <= c <= ZONE_COLS and (r, c) not in used_positions), None)
            else:
                slot = None

            if not slot:
                slot = _next_slot()

            row, col = slot
            used_positions.add((row, col))
            item["_rec_row"] = row
            item["_rec_col"] = col
            placed.append(item)

    # Build final recommendations
    result = []
    for item in classified:
        zone = item["recommended_zone"]
        row  = item.get("_rec_row", 1)
        col  = item.get("_rec_col", 1)
        rec_loc = f"{zone}-{row:02d}-{col:02d}"

        cur_zone = item["current_zone"]
        cur_loc  = item["current_location"]

        # Priority
        if zone != cur_zone:
            priority = "HIGH"
            reason   = (f"30일 출고량 {item['total_sold_30d']}개 - "
                        f"{item['abc_class']}클래스 → {zone}구역 이동 권장")
        elif row != item["current_row"]:
            priority = "MEDIUM"
            reason   = f"동일 구역 내 행 최적화 ({item['current_row']}행 → {row}행)"
        elif col != item["current_col"]:
            priority = "LOW"
            reason   = "인접 상품과의 동선 최적화"
        else:
            priority = "LOW"
            reason   = "현재 위치 최적"

        result.append({
            "product_id":           item["product_id"],
            "product_name":         item["product_name"],
            "sku":                  item["sku"],
            "abc_class":            item["abc_class"],
            "turnover_rate":        item["turnover_rate"],
            "total_sold_30d":       item["total_sold_30d"],
            "current_zone":         cur_zone,
            "current_location":     cur_loc,
            "recommended_zone":     zone,
            "recommended_row":      row,
            "recommended_col":      col,
            "recommended_location": rec_loc,
            "priority":             priority,
            "reason":               reason,
            "needs_move":           cur_loc != rec_loc,
        })

    return result


def _efficiency_gain(recs: list[dict]) -> int:
    """
    Rough estimate: each zone-change saves ~40 steps per pick.
    high_count * 40 / (total_products * avg_steps_per_pick) * 100
    """
    high = sum(1 for r in recs if r["priority"] == "HIGH")
    total = max(len(recs), 1)
    return min(round(high / total * 40), 40)


# ── Endpoints ───────────────────────────────────────────────────────────────────

@router.get("/slotting/analyze")
def analyze_slotting(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN])),
):
    products  = db.query(Product).filter(Product.is_active == True).all()
    turnover  = _turnover_data(db)
    classified = _abc_classify(products, turnover)
    recs       = _assign_locations(classified)

    relocation_needed = sum(1 for r in recs if r["needs_move"])
    efficiency        = _efficiency_gain(recs)

    abc_counts = {"A": 0, "B": 0, "C": 0, "D": 0}
    for r in recs:
        abc_counts[r["abc_class"]] = abc_counts.get(r["abc_class"], 0) + 1

    return {
        "total_products":            len(recs),
        "relocation_needed":         relocation_needed,
        "efficiency_gain_estimate":  f"피킹 시간 약 {efficiency}% 단축 예상",
        "efficiency_gain_pct":       efficiency,
        "abc_counts":                abc_counts,
        "recommendations":           recs,
        "analyzed_at":               datetime.utcnow().isoformat(),
    }


@router.get("/slotting/abc-map")
def abc_map(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lightweight endpoint: returns {product_id → abc_class}."""
    products  = db.query(Product).filter(Product.is_active == True).all()
    turnover  = _turnover_data(db)
    classified = _abc_classify(products, turnover)
    return {str(c["product_id"]): c["abc_class"] for c in classified}


@router.post("/slotting/apply/{product_id}")
def apply_recommendation(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN])),
):
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="상품을 찾을 수 없습니다.")

    # Re-compute recommendation for this single product
    products  = db.query(Product).filter(Product.is_active == True).all()
    turnover  = _turnover_data(db)
    classified = _abc_classify(products, turnover)
    recs       = _assign_locations(classified)
    rec = next((r for r in recs if r["product_id"] == product_id), None)

    if not rec or not rec["needs_move"]:
        return {"message": "이미 최적 위치입니다.", "changed": False}

    from_loc = p.location_code
    p.warehouse_zone = rec["recommended_zone"]
    p.warehouse_row  = rec["recommended_row"]
    p.warehouse_col  = rec["recommended_col"]
    p.location_code  = rec["recommended_location"]

    log = SlottingLog(
        product_id=product_id,
        from_location=from_loc,
        to_location=rec["recommended_location"],
        abc_class=rec["abc_class"],
        turnover_rate=rec["turnover_rate"],
        changed_by=current_user.id,
        reason=rec["reason"],
    )
    db.add(log)
    db.commit()

    return {
        "changed":      True,
        "product_name": p.name,
        "from":         from_loc,
        "to":           p.location_code,
        "abc_class":    rec["abc_class"],
    }


@router.post("/slotting/apply-all")
def apply_all_high(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN])),
):
    products  = db.query(Product).filter(Product.is_active == True).all()
    turnover  = _turnover_data(db)
    classified = _abc_classify(products, turnover)
    recs       = _assign_locations(classified)

    high_recs = [r for r in recs if r["priority"] == "HIGH" and r["needs_move"]]
    if not high_recs:
        return {"changed_count": 0, "message": "HIGH 우선순위 재배치 항목이 없습니다."}

    prod_map = {p.id: p for p in products}
    changed = []
    for rec in high_recs:
        p = prod_map.get(rec["product_id"])
        if not p:
            continue
        from_loc = p.location_code
        p.warehouse_zone = rec["recommended_zone"]
        p.warehouse_row  = rec["recommended_row"]
        p.warehouse_col  = rec["recommended_col"]
        p.location_code  = rec["recommended_location"]
        db.add(SlottingLog(
            product_id=p.id,
            from_location=from_loc,
            to_location=rec["recommended_location"],
            abc_class=rec["abc_class"],
            turnover_rate=rec["turnover_rate"],
            changed_by=current_user.id,
            reason=rec["reason"],
        ))
        changed.append({"product_name": p.name, "from": from_loc, "to": rec["recommended_location"]})

    db.commit()
    return {
        "changed_count": len(changed),
        "message":       f"HIGH 우선순위 {len(changed)}개 상품의 위치를 변경했습니다.",
        "changes":       changed,
    }


@router.get("/slotting/history")
def slotting_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN])),
):
    logs = (
        db.query(SlottingLog)
        .order_by(SlottingLog.changed_at.desc())
        .limit(100)
        .all()
    )
    return [
        {
            "id":            l.id,
            "product_name":  l.product.name,
            "sku":           l.product.sku,
            "from_location": l.from_location,
            "to_location":   l.to_location,
            "abc_class":     l.abc_class,
            "turnover_rate": l.turnover_rate,
            "changed_by":    l.changed_by_user.full_name if l.changed_by_user else "system",
            "changed_at":    l.changed_at.isoformat(),
            "reason":        l.reason,
        }
        for l in logs
    ]
