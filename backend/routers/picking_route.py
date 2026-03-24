from typing import List
from pydantic import BaseModel
from fastapi import APIRouter, Depends
from sqlalchemy import func as sqlfunc
from sqlalchemy.orm import Session, joinedload
from backend.database import get_db
from backend.models.user import User
from backend.models.order import Order
from backend.models.order_item import OrderItem
from backend.models.product import Product
from backend.models.inventory import Inventory
from backend.core.dependencies import get_current_user

router = APIRouter()

# ── Warehouse layout constants ──────────────────────────────────────────────────

ZONE_ORDER = ["A", "B", "C", "D"]

ZONE_META = {
    "A": {"name": "A구역 (입구 - 고회전)",  "desc": "립스틱, 마스카라 등 색조",  "base_y": 5,   "base_x": 0},
    "B": {"name": "B구역 (중간 - 중회전)",  "desc": "토너, 에센스 등 기초",      "base_y": 60,  "base_x": 0},
    "C": {"name": "C구역 (안쪽 - 저회전)",  "desc": "대용량, 특수 제품",         "base_y": 115, "base_x": 0},
    "D": {"name": "D구역 (냉장)",            "desc": "냉장 보관 필요",            "base_y": 115, "base_x": 30},
}

SHIP_POS  = (0, 30)   # 출고구 - 입구 오른쪽
RECV_POS  = (0, 0)    # 입고구 - 입구 왼쪽
ZONE_ROWS = 10
ZONE_COLS = 5
STEPS_PER_MIN = 18   # average walking speed in warehouse steps/min


# ── Algorithm helpers ───────────────────────────────────────────────────────────

def _abs_pos(zone: str, row: int, col: int) -> tuple[int, int]:
    z = ZONE_META.get(zone, ZONE_META["B"])
    return z["base_y"] + row * 5, z["base_x"] + col * 2


def _dist(y1: int, x1: int, y2: int, x2: int) -> int:
    return abs(y2 - y1) + abs(x2 - x1)


def _snake_key(row: int, col: int) -> tuple:
    """Snake-pattern sort key: even rows col ASC, odd rows col DESC."""
    return (row, col) if row % 2 == 0 else (row, -col)


def _route_distance(items: list[dict]) -> int:
    """Total Manhattan steps: SHIP → items in order → RECV → SHIP."""
    dist = 0
    py, px = SHIP_POS
    for item in items:
        iy, ix = _abs_pos(item.get("zone", "B"), item.get("row", 1), item.get("col", 1))
        dist += _dist(py, px, iy, ix)
        py, px = iy, ix
    dist += _dist(py, px, *RECV_POS)
    dist += _dist(*RECV_POS, *SHIP_POS)
    return dist


def optimize_picking_route(items: list[dict]) -> tuple[list[dict], int]:
    """
    Zone sweep: SHIP → A → B → C → D → RECV → SHIP.
    Within each zone: snake pattern (even rows col 1→5, odd rows col 5→1).
    Returns (ordered_items, total_steps).
    """
    if not items:
        return [], 0

    zone_groups: dict[str, list[dict]] = {}
    for item in items:
        zone_groups.setdefault(item.get("zone", "B"), []).append(item)

    ordered: list[dict] = []
    for zone in ZONE_ORDER:
        if zone not in zone_groups:
            continue
        ordered.extend(
            sorted(zone_groups[zone], key=lambda it: _snake_key(it.get("row", 1), it.get("col", 1)))
        )

    for i, item in enumerate(ordered, start=1):
        item["sequence"] = i

    return ordered, _route_distance(ordered)


# ── Endpoints ───────────────────────────────────────────────────────────────────

class RouteRequest(BaseModel):
    order_ids: List[int]


@router.post("/picking-route/optimize")
def optimize_route(
    body: RouteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return optimised picking sequence for a set of orders."""
    orders = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.product))
        .filter(Order.id.in_(body.order_ids))
        .all()
    )

    # Consolidate items: merge same product across multiple orders
    product_map: dict[int, dict] = {}
    for order in orders:
        for oi in order.items:
            p = oi.product
            if p.id not in product_map:
                zone = p.warehouse_zone or "B"
                row  = p.warehouse_row  or 1
                col  = p.warehouse_col  or 1
                product_map[p.id] = {
                    "product_id":    p.id,
                    "product_name":  p.name,
                    "sku":           p.sku,
                    "zone":          zone,
                    "row":           row,
                    "col":           col,
                    "location_code": p.location_code or f"{zone}-{row:02d}-{col:02d}",
                    "quantity":      0,
                    "order_numbers": [],
                }
            product_map[p.id]["quantity"] += oi.quantity
            if order.order_number not in product_map[p.id]["order_numbers"]:
                product_map[p.id]["order_numbers"].append(order.order_number)

    items = list(product_map.values())
    optimized, total_steps = optimize_picking_route(items)

    # Compare against naive (original) order
    naive_steps = _route_distance(list(product_map.values()))
    saved_pct   = max(0, round((naive_steps - total_steps) / max(naive_steps, 1) * 100))

    zones_visited = list(dict.fromkeys(it["zone"] for it in optimized))

    route_out = [
        {
            "sequence":      it["sequence"],
            "location":      it["location_code"],
            "zone":          it["zone"],
            "zone_name":     ZONE_META.get(it["zone"], {}).get("name", ""),
            "product_name":  it["product_name"],
            "sku":           it["sku"],
            "quantity":      it["quantity"],
            "order_numbers": it["order_numbers"],
        }
        for it in optimized
    ]

    return {
        "route":                    route_out,
        "total_steps":              total_steps,
        "estimated_minutes":        max(1, round(total_steps / STEPS_PER_MIN)),
        "zones_visited":            zones_visited,
        "distance_saved_vs_random": f"{saved_pct}%",
    }


@router.get("/picking-route/warehouse-map")
def warehouse_map(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return full warehouse grid layout with product locations and stock levels."""
    products = (
        db.query(Product)
        .filter(Product.is_active == True)
        .options(joinedload(Product.seller))
        .all()
    )

    stock_rows = (
        db.query(Inventory.product_id, sqlfunc.sum(Inventory.quantity))
        .group_by(Inventory.product_id)
        .all()
    )
    stock_map = {r[0]: (r[1] or 0) for r in stock_rows}

    # Map location_code → product info + stock
    loc_map: dict[str, dict] = {}
    for p in products:
        if p.location_code:
            stock = stock_map.get(p.id, 0)
            status = "normal" if stock > 50 else "warning" if stock > 10 else "critical" if stock > 0 else "empty"
            seller_name = ""
            if p.seller:
                seller_name = p.seller.company_name or p.seller.full_name or ""
            loc_map[p.location_code] = {
                "product_id":   p.id,
                "product_name": p.name,
                "sku":          p.sku,
                "seller_name":  seller_name,
                "total_stock":  stock,
                "status":       status,
            }

    zones_out = []
    for zone in ZONE_ORDER:
        meta = ZONE_META[zone]
        locations = []
        for row in range(1, ZONE_ROWS + 1):
            for col in range(1, ZONE_COLS + 1):
                code = f"{zone}-{row:02d}-{col:02d}"
                loc  = loc_map.get(code, {})
                locations.append({
                    "code":         code,
                    "row":          row,
                    "col":          col,
                    "product_id":   loc.get("product_id"),
                    "product_name": loc.get("product_name"),
                    "sku":          loc.get("sku"),
                    "seller_name":  loc.get("seller_name"),
                    "total_stock":  loc.get("total_stock", 0),
                    "status":       loc.get("status", "empty"),
                })
        zones_out.append({
            "zone":        zone,
            "name":        meta["name"],
            "description": meta["desc"],
            "rows":        ZONE_ROWS,
            "cols":        ZONE_COLS,
            "locations":   locations,
        })

    total_slots    = sum(ZONE_ROWS * ZONE_COLS for _ in ZONE_ORDER)
    occupied_slots = len(loc_map)
    alert_slots    = sum(1 for v in loc_map.values() if v["status"] in ("critical", "warning"))

    return {
        "zones":          zones_out,
        "total_slots":    total_slots,
        "occupied_slots": occupied_slots,
        "empty_slots":    total_slots - occupied_slots,
        "alert_slots":    alert_slots,
    }
