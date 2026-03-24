import math
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from backend.database import get_db
from backend.models.user import User, UserRole
from backend.models.delivery import Delivery, DeliveryStatus
from backend.core.dependencies import require_role

router = APIRouter()

DEPOT_LAT = 37.4563
DEPOT_LNG = 126.7052
DEPOT_NAME = "FullFit 인천 창고"

# Address keyword → (base_lat, base_lng)
_COORD_MAP = [
    ("강남구", 37.5172, 127.0473),
    ("서초구", 37.4837, 127.0324),
    ("마포구", 37.5663, 126.9014),
    ("송파구", 37.5145, 127.1059),
    ("강북구", 37.6397, 127.0254),
    ("영등포", 37.5264, 126.8962),
    ("해운대", 35.1631, 129.1628),
    ("수성구", 35.8580, 128.6330),
    ("유성구", 36.3628, 127.3566),
    ("연수구", 37.4016, 126.6753),
    ("성남시", 37.4449, 127.1388),
    ("수원시", 37.2636, 127.0286),
    ("부천시", 37.4989, 126.7831),
    ("고양시", 37.6584, 126.8320),
    ("부산",   35.1796, 129.0756),
    ("대구",   35.8714, 128.6014),
    ("광주",   35.1595, 126.8526),
    ("대전",   36.3504, 127.3845),
    ("울산",   35.5384, 129.3114),
    ("인천",   37.4563, 126.7052),
    ("서울",   37.5665, 126.9780),
    ("경기",   37.4138, 127.5183),
]


def address_to_coords(address: str, jitter_seed: int = 0) -> tuple[float, float]:
    """Convert an address string to (lat, lng) with a deterministic small jitter."""
    base_lat, base_lng = 37.4563, 126.7052  # default: Incheon
    for keyword, blat, blng in _COORD_MAP:
        if address and keyword in address:
            base_lat, base_lng = blat, blng
            break
    # Deterministic ±0.01° jitter (~1 km) based on delivery id
    lat_off = ((jitter_seed * 7 + 3)  % 200 - 100) / 10_000.0
    lng_off = ((jitter_seed * 13 + 7) % 200 - 100) / 10_000.0
    return round(base_lat + lat_off, 4), round(base_lng + lng_off, 4)


def haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
         * math.sin(dlng / 2) ** 2)
    return R * 2 * math.asin(math.sqrt(a))


def nearest_neighbor_vrp(
    orders: list[dict],
    depot_lat: float = DEPOT_LAT,
    depot_lng: float = DEPOT_LNG,
) -> list[dict]:
    """Nearest Neighbour heuristic: greedily pick the closest unvisited stop."""
    unvisited = list(orders)
    route: list[dict] = []
    cur_lat, cur_lng = depot_lat, depot_lng

    while unvisited:
        nearest = min(
            unvisited,
            key=lambda o: haversine(cur_lat, cur_lng, o["lat"], o["lng"]),
        )
        route.append(nearest)
        cur_lat, cur_lng = nearest["lat"], nearest["lng"]
        unvisited.remove(nearest)

    return route


@router.get("/vrp/optimize")
def optimize_route(
    date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN])),
):
    q = (
        db.query(Delivery)
        .options(joinedload(Delivery.order))
        .filter(Delivery.status.in_([DeliveryStatus.IN_TRANSIT, DeliveryStatus.READY]))
    )
    if date:
        from sqlalchemy import func as sqlfunc
        try:
            q = q.filter(sqlfunc.date(Delivery.created_at) == date)
        except Exception:
            pass

    deliveries = q.order_by(Delivery.id).all()

    # Build orders list; fill missing coords and persist them
    needs_commit = False
    orders = []
    for d in deliveries:
        lat, lng = d.delivery_lat, d.delivery_lng
        if lat is None or lng is None:
            lat, lng = address_to_coords(d.order.receiver_address, d.id)
            d.delivery_lat, d.delivery_lng = lat, lng
            needs_commit = True
        orders.append({
            "delivery_id": d.id,
            "order_number": d.order.order_number,
            "receiver_name": d.order.receiver_name,
            "address": d.order.receiver_address,
            "lat": lat,
            "lng": lng,
        })
    if needs_commit:
        db.commit()

    if not orders:
        return {
            "depot": {"lat": DEPOT_LAT, "lng": DEPOT_LNG, "name": DEPOT_NAME},
            "route": [],
            "total_distance": 0.0,
            "naive_distance": 0.0,
            "estimated_stops": 0,
            "optimized_at": datetime.utcnow().isoformat(),
        }

    # Optimized route
    optimized = nearest_neighbor_vrp(orders)

    route_out = []
    total_dist = 0.0
    prev_lat, prev_lng = DEPOT_LAT, DEPOT_LNG
    for i, stop in enumerate(optimized, start=1):
        dist = haversine(prev_lat, prev_lng, stop["lat"], stop["lng"])
        total_dist += dist
        route_out.append({
            "order": i,
            "delivery_id": stop["delivery_id"],
            "order_number": stop["order_number"],
            "receiver_name": stop["receiver_name"],
            "address": stop["address"],
            "lat": stop["lat"],
            "lng": stop["lng"],
            "estimated_arrival": f"배송 {i}번째",
            "distance_from_prev": round(dist, 1),
        })
        prev_lat, prev_lng = stop["lat"], stop["lng"]

    # Naive (original DB order) total distance for comparison
    naive_dist = 0.0
    prev_lat, prev_lng = DEPOT_LAT, DEPOT_LNG
    for stop in orders:
        naive_dist += haversine(prev_lat, prev_lng, stop["lat"], stop["lng"])
        prev_lat, prev_lng = stop["lat"], stop["lng"]

    return {
        "depot": {"lat": DEPOT_LAT, "lng": DEPOT_LNG, "name": DEPOT_NAME},
        "route": route_out,
        "total_distance": round(total_dist, 1),
        "naive_distance": round(naive_dist, 1),
        "estimated_stops": len(route_out),
        "optimized_at": datetime.utcnow().isoformat(),
    }
