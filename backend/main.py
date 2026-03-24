import asyncio
import random
import time
from datetime import date, datetime, timedelta
from decimal import Decimal
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.database import engine, SessionLocal
from backend.models.user import Base, User, UserRole
from backend.models.product import Product, StorageType   # noqa: F401
from backend.models.inventory import Inventory             # noqa: F401
from backend.models.inbound import Inbound                 # noqa: F401
from backend.models.order import Order, OrderChannel, OrderStatus  # noqa: F401
from backend.models.order_item import OrderItem            # noqa: F401
from backend.models.delivery import Delivery, Carrier, DeliveryStatus  # noqa: F401
from backend.models.settlement import Settlement, SettlementStatus      # noqa: F401
from backend.models.return_request import ReturnRequest, ReturnReason, ReturnStatus  # noqa: F401
from backend.models.sync_history import SyncHistory                                  # noqa: F401
from backend.models.promotion import Promotion, PromotionChannel                     # noqa: F401
from backend.models.notification import Notification, NotificationType               # noqa: F401
from backend.models.chat_room import ChatRoom, RoomType                              # noqa: F401
from backend.models.chat_message import ChatMessage                                  # noqa: F401
from backend.models.demand_history import DemandHistory                              # noqa: F401
from backend.models.order_history import OrderHistory                                # noqa: F401
from backend.models.order_issue import OrderIssue                                    # noqa: F401
from backend.models.reorder import ReorderRecommendation                             # noqa: F401
from backend.models.batch_picking import BatchPicking                                # noqa: F401
from backend.models.slotting_log import SlottingLog                                  # noqa: F401
from backend.models.inbound_schedule import InboundSchedule                          # noqa: F401
from backend.models.inventory_adjustment import InventoryAdjustment                  # noqa: F401
from backend.core.security import hash_password
from backend.routers import auth, inventory, order, delivery, settlement, stats
from backend.routers import return_request, channel_sync, promotion, notification, seller_management, chat
from backend.routers import forecast, reorder, vrp, batch_picking, picking_route, slotting
from backend.routers import inbound_schedule, issue, kpi, inventory_adjust
from backend.routers.ai_assistant import router as ai_router
from backend.routers.vrp import address_to_coords as _coord_from_address

app = FastAPI(title="FullFit API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(inventory.router, tags=["Inventory"])
app.include_router(order.router, tags=["Orders"])
app.include_router(delivery.router, tags=["Deliveries"])
app.include_router(settlement.router, tags=["Settlements"])
app.include_router(stats.router, tags=["Stats"])
app.include_router(return_request.router, tags=["Returns"])
app.include_router(channel_sync.router, tags=["ChannelSync"])
app.include_router(promotion.router, tags=["Promotions"])
app.include_router(notification.router, tags=["Notifications"])
app.include_router(seller_management.router, tags=["Sellers"])
app.include_router(chat.router, tags=["Chat"])
app.include_router(forecast.router, tags=["Forecast"])
app.include_router(reorder.router, tags=["Reorder"])
app.include_router(vrp.router, tags=["VRP"])
app.include_router(batch_picking.router, tags=["BatchPicking"])
app.include_router(picking_route.router, tags=["PickingRoute"])
app.include_router(slotting.router,          tags=["Slotting"])
app.include_router(inbound_schedule.router, tags=["InboundSchedule"])
app.include_router(issue.router, tags=["Issues"])
app.include_router(kpi.router, tags=["KPI"])
app.include_router(inventory_adjust.router, tags=["InventoryAdjust"])
app.include_router(ai_router)


# ── Constants ─────────────────────────────────────────────────────────────────

_PRODUCT_PRICES = {
    "DAL-001": 38000, "DAL-002": 52000, "DAL-003": 28000, "DAL-004": 32000,
    "CLI-001": 26000, "CLI-002": 26000, "CLI-003": 14000, "CLI-004":  9000, "CLI-005": 22000,
    "GOO-001": 23000, "GOO-002": 19000, "GOO-003": 35000, "GOO-004": 18000,
    "BPL-001": 13000, "BPL-002": 27000, "BPL-003": 24000,
    "BBI-001": 11000, "BBI-002": 11000, "BBI-003": 13000, "BBI-004": 18000,
    "SKF-001": 16000, "SKF-002": 14000, "SKF-003": 17000, "SKF-004": 22000,
}

_NAMES = [
    '김민지', '이수진', '박지현', '최유리', '정하나', '한예슬', '오지민', '김예린',
    '이민준', '박서준', '최지우', '장동건', '손예진', '오정세', '신민아', '이도현',
    '김태현', '박민서', '최예린', '정유진', '강다현', '윤서준', '임채영', '한주원',
    '오세진', '김도현', '이지은', '박수진', '김채연', '이하은', '박준서', '최민준',
    '정서연', '강지후', '윤수아', '임도윤', '한예린', '오채원', '신태양', '김하늘',
]
_PHONES = [f"010-{1000 + i:04d}-{2000 + i:04d}" for i in range(50)]
_ADDRS = [
    '서울 강남구 테헤란로 123', '서울 서초구 방배로 45', '서울 마포구 홍대입구로 77',
    '서울 영등포구 여의대방로 32', '서울 강북구 수유로 88', '서울 성동구 왕십리로 150',
    '경기 성남시 분당구 판교로 8', '경기 수원시 영통구 광교로 22', '경기 고양시 일산서구 킨텍스로 200',
    '경기 부천시 원미구 부천로 198', '경기 용인시 수지구 죽전로 50', '경기 안양시 동안구 관악대로 30',
    '인천 연수구 송도대로 100', '인천 남동구 인하로 55', '인천 부평구 부평대로 95',
    '부산 해운대구 우동로 55', '부산 사하구 하단로 22', '부산 연제구 연산로 110',
    '대구 수성구 달구벌대로 200', '대구 달서구 달구벌대로 400',
    '광주 서구 상무중앙로 30', '광주 북구 첨단과기로 77',
    '대전 유성구 대학로 99', '대전 서구 둔산대로 100',
    '울산 남구 삼산로 15', '울산 중구 문화로 50',
]
_CHANNELS = [OrderChannel.SMARTSTORE, OrderChannel.OLIVEYOUNG, OrderChannel.ZIGZAG, OrderChannel.CAFE24, OrderChannel.MANUAL]
_CHANNEL_W = [35, 25, 20, 15, 5]
_COURIERS  = [Carrier.CJ, Carrier.LOTTE, Carrier.HANJIN, Carrier.ROSEN]
_COURIER_W = [40, 30, 20, 10]


def _pick(lst, weights=None):
    return random.choices(lst, weights=weights, k=1)[0]


def _tracking_number(carrier: Carrier) -> str:
    digits = ''.join(str(random.randint(0, 9)) for _ in range(10))
    prefix = {Carrier.CJ: 'CJ', Carrier.LOTTE: 'LT', Carrier.HANJIN: 'HJ', Carrier.ROSEN: 'RS'}.get(carrier, 'ET')
    return prefix + digits


# ── Seed helpers ───────────────────────────────────────────────────────────────

def seed_users(db):
    if db.query(User).count() > 0:
        return
    users = [
        User(email="admin@fullfit.com",    hashed_password=hash_password("admin1234"),
             role=UserRole.ADMIN,  full_name="김철수",  joined_at=datetime(2025, 1, 1)),
        User(email="worker@fullfit.com",   hashed_password=hash_password("worker1234"),
             role=UserRole.WORKER, full_name="이영희",  joined_at=datetime(2025, 1, 1)),
        User(email="dalba@fullfit.com",    hashed_password=hash_password("seller1234"),
             role=UserRole.SELLER, full_name="달바",    company_name="d'Alba",
             business_number="000-00-00001", joined_at=datetime(2025, 6, 1)),
        User(email="clio@fullfit.com",     hashed_password=hash_password("seller1234"),
             role=UserRole.SELLER, full_name="클리오",  company_name="CLIO Cosmetics",
             business_number="123-45-67891", joined_at=datetime(2025, 9, 15)),
        User(email="goodal@fullfit.com",   hashed_password=hash_password("seller1234"),
             role=UserRole.SELLER, full_name="구달",    company_name="goodal",
             business_number="987-65-43210", joined_at=datetime(2026, 1, 20)),
        User(email="bplain@fullfit.com",   hashed_password=hash_password("seller1234"),
             role=UserRole.SELLER, full_name="비플레인", company_name="b.plain",
             business_number="111-22-33333", joined_at=datetime(2026, 2, 1)),
        User(email="bbia@fullfit.com",     hashed_password=hash_password("seller1234"),
             role=UserRole.SELLER, full_name="삐아",    company_name="BBIA Cosmetic",
             business_number="444-55-66666", joined_at=datetime(2026, 2, 15)),
        User(email="skinfood@fullfit.com", hashed_password=hash_password("seller1234"),
             role=UserRole.SELLER, full_name="스킨푸드", company_name="SKINFOOD",
             business_number="777-88-99999", joined_at=datetime(2026, 3, 1)),
    ]
    db.add_all(users)
    db.commit()
    for u in db.query(User).all():
        print(f"[Seed] ✔ {u.email} (role={u.role.value}, active={u.is_active})")
    print("✅ Seed users created — all 8 accounts ready.")


def seed_products(db):
    """Seed all 6 brand products with warehouse locations and inventory."""
    if db.query(Product).count() > 0:
        return

    sellers = {u.email: u for u in db.query(User).all()}

    today = date.today()
    RT = StorageType.ROOM_TEMP
    CD = StorageType.COLD

    # (name, sku, barcode, category, stock, zone, row, col, expiry, storage_type)
    brand_specs = [
        ("dalba@fullfit.com", [
            ("달바 화이트트러플 퍼스트 스프레이 세럼 150ml", "DAL-001", "8801234560001", "스킨케어", 180, "A", 1, 1, date(2027, 6, 30), CD),
            ("달바 울트라V 리프팅 펩타이드 에센스",          "DAL-002", "8801234560002", "스킨케어", 120, "B", 1, 1, date(2027, 3, 31), RT),
            ("달바 선크림 선세럼 SPF50+",                    "DAL-003", "8801234560003", "선케어",   250, "A", 1, 2, date(2026, 12, 31), RT),
            ("달바 토너패드 200매",                          "DAL-004", "8801234560004", "스킨케어", 150, "A", 2, 1, date(2027, 1, 31), RT),
        ]),
        ("clio@fullfit.com", [
            ("클리오 킬커버 메쉬글로우 쿠션 21호",  "CLI-001", "8809000001001", "색조",  200, "A", 1, 3, date(2027, 6, 30), RT),
            ("클리오 킬커버 파운웨어 쿠션 23호",    "CLI-002", "8809000001002", "색조",  180, "A", 1, 4, date(2027, 6, 30), RT),
            ("클리오 킬래쉬 슈퍼프루프 마스카라",   "CLI-003", "8809000001003", "색조",  300, "A", 2, 2, today + timedelta(days=15), RT),
            ("클리오 샤프 심플 펜슬 아이라이너",    "CLI-004", "8809000001004", "색조",  350, "A", 2, 3, date(2026, 11, 30), RT),
            ("클리오 프로 아이 팔레트 08호",         "CLI-005", "8809000001005", "색조",  150, "B", 1, 2, date(2027, 6, 30), RT),
        ]),
        ("goodal@fullfit.com", [
            ("구달 청귤 비타C 잡티세럼 30ml",    "GOO-001", "8809000002001", "스킨케어", 280, "A", 3, 1, date(2026, 10, 31), CD),
            ("구달 아이스 어성초 수딩크림 100ml", "GOO-002", "8809000002002", "스킨케어", 220, "A", 3, 2, date(2026, 12, 31), RT),
            ("구달 흑당근 레티놀 탄력 앰플 30ml", "GOO-003", "8809000002003", "스킨케어",   8, "B", 2, 1, date(2027, 3, 31), RT),
            ("구달 청귤 비타C 토너 150ml",        "GOO-004", "8809000002004", "스킨케어", 180, "A", 3, 3, date(2026, 11, 30), RT),
        ]),
        ("bplain@fullfit.com", [
            ("비플레인 약산성 클렌징폼 150ml",    "BPL-001", "8809000003001", "클렌징",   200, "B", 2, 2, date(2027, 6, 30), RT),
            ("비플레인 판테놀 수분 세럼 50ml",    "BPL-002", "8809000003002", "스킨케어", 150, "B", 2, 3, date(2027, 4, 30), RT),
            ("비플레인 세라마이드 장벽크림 80ml", "BPL-003", "8809000003003", "스킨케어",  12, "B", 3, 1, date(2027, 5, 31), RT),
        ]),
        ("bbia@fullfit.com", [
            ("삐아 라스트 립틴트 OR01 레드빈", "BBI-001", "8809000004001", "색조", 400, "A", 4, 1, today + timedelta(days=25), RT),
            ("삐아 라스트 립틴트 OR02 코랄",   "BBI-002", "8809000004002", "색조", 380, "A", 4, 2, date(2027, 6, 30), RT),
            ("삐아 언더 아이 픽서",            "BBI-003", "8809000004003", "색조", 300, "A", 4, 3, date(2027, 3, 31), RT),
            ("삐아 아이섀도우 팔레트 14호",    "BBI-004", "8809000004004", "색조", 200, "B", 3, 2, date(2027, 6, 30), RT),
        ]),
        ("skinfood@fullfit.com", [
            ("스킨푸드 블랙슈가 퍼펙트 스크럽 2X 90ml", "SKF-001", "8809000005001", "스킨케어", 180, "B", 3, 3, today + timedelta(days=7), RT),
            ("스킨푸드 토마토 화이트닝 워터 토너",       "SKF-002", "8809000005002", "스킨케어", 160, "B", 4, 1, date(2026, 9, 30), RT),
            ("스킨푸드 쌀겨 수분 수딩 크림 300ml",       "SKF-003", "8809000005003", "스킨케어", 140, "B", 4, 2, date(2026, 10, 31), RT),
            ("스킨푸드 당근 카로틴 아이크림 30ml",       "SKF-004", "8809000005004", "스킨케어",   5, "C", 1, 1, date(2026, 7, 31), RT),
        ]),
    ]

    total = 0
    for email, items in brand_specs:
        seller_u = sellers.get(email)
        if not seller_u:
            continue
        for name, sku, barcode, cat, stock, zone, row, col, expiry, storage_type in items:
            p = Product(
                seller_id=seller_u.id,
                name=name, sku=sku, barcode=barcode, category=cat,
                storage_type=storage_type,
                warehouse_zone=zone, warehouse_row=row, warehouse_col=col,
                location_code=f"{zone}-{row:02d}-{col:02d}",
            )
            db.add(p)
            db.flush()
            db.add(Inventory(
                product_id=p.id,
                lot_number=f"LOT-{sku}-001",
                expiry_date=expiry,
                quantity=stock,
                inbound_date=date(2026, 1, 10),
            ))
            total += 1

    db.commit()

    # Fallback: ensure no product has a null location_code
    from sqlalchemy import text
    db.execute(text(
        "UPDATE products SET location_code = 'B-01-01', warehouse_zone = 'B' "
        "WHERE location_code IS NULL OR location_code = ''"
    ))
    db.commit()
    print(f"✅ Seed products + inventory created ({total} products).")


def seed_orders_large(db):
    """Seed 200 realistic orders across all 6 sellers with correct status distribution."""
    if db.query(Order).count() > 0:
        return

    random.seed(2026)
    now = datetime.utcnow()
    today_str = datetime.now().strftime("%Y%m%d")

    sellers = {u.email: u for u in db.query(User).filter(User.role == UserRole.SELLER).all()}
    products_by_seller = {}
    for s in sellers.values():
        prods = db.query(Product).filter(Product.seller_id == s.id).all()
        products_by_seller[s.id] = prods

    # Per seller: (n_received, n_picking, n_packed, n_shipped, n_delivered, n_cancelled)
    # Totals: RECEIVED=30, PICKING=15, PACKED=10, SHIPPED=80, DELIVERED=60, CANCELLED=5
    per_seller = [
        ("dalba@fullfit.com",     6, 3, 2, 16, 12, 1),
        ("clio@fullfit.com",      6, 3, 2, 16, 12, 1),
        ("goodal@fullfit.com",    5, 3, 2, 14, 10, 1),
        ("bplain@fullfit.com",    5, 2, 2, 12, 10, 1),
        ("bbia@fullfit.com",      5, 2, 1, 12, 10, 1),
        ("skinfood@fullfit.com",  3, 2, 1, 10,  6, 0),
    ]

    status_groups = [
        (OrderStatus.RECEIVED,  0, 2),   # (status, min_days_ago, max_days_ago)
        (OrderStatus.PICKING,   1, 3),
        (OrderStatus.PACKED,    2, 5),
        (OrderStatus.SHIPPED,   3, 15),
        (OrderStatus.DELIVERED, 7, 30),
        (OrderStatus.CANCELLED, 1, 7),
    ]

    seq = 1
    for email, *counts in per_seller:
        seller_u = sellers.get(email)
        if not seller_u:
            continue
        prods = products_by_seller.get(seller_u.id, [])
        if not prods:
            continue

        for (status, min_days, max_days), count in zip(status_groups, counts):
            for i in range(count):
                days_ago = random.randint(min_days, max_days)
                created  = now - timedelta(days=days_ago)
                name     = _NAMES[seq % len(_NAMES)]
                phone    = _PHONES[seq % len(_PHONES)]
                addr     = _ADDRS[seq % len(_ADDRS)]
                channel  = _pick(_CHANNELS, _CHANNEL_W)
                prod     = prods[seq % len(prods)]
                qty      = random.randint(1, 2)
                unit_price = _PRODUCT_PRICES.get(prod.sku, 25000)
                amount   = Decimal(str(unit_price * qty))

                o = Order(
                    order_number=f"FF-{today_str}-{seq:04d}",
                    channel=channel,
                    seller_id=seller_u.id,
                    status=status,
                    receiver_name=name,
                    receiver_phone=phone,
                    receiver_address=addr,
                    total_amount=amount,
                    created_at=created,
                )
                db.add(o)
                db.flush()
                db.add(OrderItem(
                    order_id=o.id,
                    product_id=prod.id,
                    quantity=qty,
                    unit_price=Decimal(str(unit_price)),
                ))

                # Delivery record for SHIPPED / DELIVERED
                if status in (OrderStatus.SHIPPED, OrderStatus.DELIVERED):
                    courier  = _pick(_COURIERS, _COURIER_W)
                    d_status = DeliveryStatus.IN_TRANSIT if status == OrderStatus.SHIPPED else DeliveryStatus.DELIVERED
                    d = Delivery(
                        order_id=o.id,
                        tracking_number=_tracking_number(courier),
                        carrier=courier,
                        status=d_status,
                        estimated_delivery=date.today() + timedelta(days=1),
                    )
                    if status == OrderStatus.DELIVERED:
                        d.actual_delivery = date.today() - timedelta(days=random.randint(1, max(1, days_ago - 2)))
                    db.add(d)

                seq += 1

    db.commit()
    print(f"✅ Seed 200 orders + deliveries created (last seq={seq - 1}).")


def seed_settlements(db):
    if db.query(Settlement).count() > 0:
        return
    # (email, year_month, storage, inbound, outbound, extra, status, confirmed_at)
    rows = [
        ("dalba@fullfit.com",    "2026-02",  75000,  9000, 48000, 0, SettlementStatus.CONFIRMED, datetime(2026, 3, 1)),
        ("clio@fullfit.com",     "2026-02",  62000,  6200, 38400, 0, SettlementStatus.CONFIRMED, datetime(2026, 3, 1)),
        ("goodal@fullfit.com",   "2026-02",  48000,  4800, 28800, 0, SettlementStatus.CONFIRMED, datetime(2026, 3, 1)),
        ("bplain@fullfit.com",   "2026-02",  31000,  3100, 19200, 0, SettlementStatus.CONFIRMED, datetime(2026, 3, 1)),
        ("bbia@fullfit.com",     "2026-02",  54000,  5400, 32400, 0, SettlementStatus.CONFIRMED, datetime(2026, 3, 1)),
        ("skinfood@fullfit.com", "2026-02",  38000,  3800, 22800, 0, SettlementStatus.CONFIRMED, datetime(2026, 3, 1)),
        ("dalba@fullfit.com",    "2026-03",  80000,  9600, 52800, 0, SettlementStatus.DRAFT,     None),
        ("clio@fullfit.com",     "2026-03",  65000,  6500, 40000, 0, SettlementStatus.DRAFT,     None),
        ("goodal@fullfit.com",   "2026-03",  50000,  5000, 30000, 0, SettlementStatus.DRAFT,     None),
        ("bplain@fullfit.com",   "2026-03",  33000,  3300, 20000, 0, SettlementStatus.DRAFT,     None),
        ("bbia@fullfit.com",     "2026-03",  56000,  5600, 33600, 0, SettlementStatus.DRAFT,     None),
        ("skinfood@fullfit.com", "2026-03",  40000,  4000, 24000, 0, SettlementStatus.DRAFT,     None),
    ]
    added = 0
    for email, ym, storage, inb, out, extra, status, confirmed_at in rows:
        seller = db.query(User).filter(User.email == email).first()
        if not seller:
            continue
        total = Decimal(str(storage + inb + out + extra))
        db.add(Settlement(
            seller_id=seller.id, year_month=ym,
            storage_fee=Decimal(str(storage)), inbound_fee=Decimal(str(inb)),
            outbound_fee=Decimal(str(out)), extra_fee=Decimal(str(extra)),
            total_fee=total, status=status, confirmed_at=confirmed_at,
        ))
        added += 1
    db.commit()
    print(f"✅ Seed settlements created ({added} records for all brands).")


def seed_returns(db):
    if db.query(ReturnRequest).count() > 0:
        return
    seller = db.query(User).filter(User.email == "dalba@fullfit.com").first()
    if not seller:
        return
    delivered = (
        db.query(Order)
        .filter(Order.seller_id == seller.id, Order.status == OrderStatus.DELIVERED)
        .limit(2).all()
    )
    if len(delivered) < 2:
        return
    db.add_all([
        ReturnRequest(
            order_id=delivered[0].id, seller_id=seller.id,
            reason=ReturnReason.DEFECTIVE, status=ReturnStatus.IN_REVIEW,
            note="제품 불량으로 인한 반품 요청입니다.", inspection_note="검수 진행 중",
        ),
        ReturnRequest(
            order_id=delivered[1].id, seller_id=seller.id,
            reason=ReturnReason.CHANGE_OF_MIND, status=ReturnStatus.REQUESTED,
            note="단순 변심으로 반품합니다.",
        ),
    ])
    db.commit()
    print("✅ Seed returns created.")


def seed_promotions(db):
    if db.query(Promotion).count() > 0:
        return
    db.add_all([
        Promotion(name="올영데이", channel=PromotionChannel.OLIVEYOUNG,
                  start_date=date(2026, 4, 25), end_date=date(2026, 4, 27),
                  expected_order_multiplier=2.0, note="올리브영 정기 올영데이 이벤트"),
        Promotion(name="올영세일 (봄)", channel=PromotionChannel.OLIVEYOUNG,
                  start_date=date(2026, 6, 1), end_date=date(2026, 6, 7),
                  expected_order_multiplier=4.0, note="봄 시즌 대형 세일"),
        Promotion(name="직잭세일 (여름)", channel=PromotionChannel.ZIGZAG,
                  start_date=date(2026, 6, 24), end_date=date(2026, 7, 8),
                  expected_order_multiplier=3.5, note="지그재그 여름 특가"),
        Promotion(name="블랙프라이데이", channel=PromotionChannel.ALL,
                  start_date=date(2026, 11, 18), end_date=date(2026, 12, 2),
                  expected_order_multiplier=5.0, note="연중 최대 세일 이벤트"),
    ])
    db.commit()
    print("✅ Seed promotions created.")


def seed_notifications(db):
    if db.query(Notification).count() > 0:
        return
    admin  = db.query(User).filter(User.email == "admin@fullfit.com").first()
    worker = db.query(User).filter(User.email == "worker@fullfit.com").first()
    seller = db.query(User).filter(User.email == "dalba@fullfit.com").first()
    if not admin or not seller:
        return
    notifications = [
        Notification(user_id=admin.id, type=NotificationType.ORDER_RECEIVED,
                     title="새 주문 접수", message="주문번호 FF-20260317-0009 (CAFE24) 접수되었습니다."),
        Notification(user_id=admin.id, type=NotificationType.STOCK_LOW,
                     title="재고 부족: 달바 에센스", message="달바 울트라V 리프팅 펩타이드 에센스 (DAL-002) 재고가 30개로 부족합니다."),
        Notification(user_id=admin.id, type=NotificationType.EXPIRY_ALERT,
                     title="유통기한 임박 경고", message="달바 화이트트러플 스프레이 세럼 LOT-DAL-001-001 유통기한이 30일 남았습니다."),
        Notification(user_id=admin.id, type=NotificationType.PROMOTION_ALERT,
                     title="프로모션 D-39: 올영데이", message="올리브영 올영데이가 39일 후 시작됩니다. 재고를 미리 확보하세요."),
        Notification(user_id=admin.id, type=NotificationType.SETTLEMENT_READY,
                     title="2026-02 정산 확정", message="달바(d'Alba) 브랜드의 2026-02 정산이 확정되었습니다.", is_read=True),
        Notification(user_id=seller.id, type=NotificationType.ORDER_RECEIVED,
                     title="새 주문이 들어왔습니다", message="스마트스토어에서 새 주문이 접수되었습니다."),
        Notification(user_id=seller.id, type=NotificationType.DELIVERY_UPDATE,
                     title="배송 상태 변경: 배송중", message="주문 배송이 [배송중] 상태로 변경되었습니다."),
        Notification(user_id=seller.id, type=NotificationType.SETTLEMENT_READY,
                     title="2026-02 정산 확정", message="2026-02 정산이 확정되었습니다. 총 정산금액: ₩132,000"),
        Notification(user_id=seller.id, type=NotificationType.STOCK_LOW,
                     title="재고 부족: 달바 에센스", message="달바 울트라V 리프팅 펩타이드 에센스 (DAL-002) 재고가 30개로 부족합니다."),
        Notification(user_id=seller.id, type=NotificationType.PROMOTION_ALERT,
                     title="프로모션 예정: 올영데이", message="올영데이가 39일 후 시작됩니다. 재고를 미리 확보하세요.", is_read=True),
    ]
    if worker:
        notifications += [
            Notification(user_id=worker.id, type=NotificationType.ORDER_RECEIVED,
                         title="새 피킹 작업 배정", message="주문 3건이 피킹 대기 중입니다."),
            Notification(user_id=worker.id, type=NotificationType.EXPIRY_ALERT,
                         title="유통기한 임박 상품 입고됨", message="달바 화이트트러플 스프레이 세럼 유통기한 임박 알림."),
            Notification(user_id=worker.id, type=NotificationType.STOCK_LOW,
                         title="재고 부족 경고", message="달바 울트라V 에센스 재고가 30개 미만입니다."),
            Notification(user_id=worker.id, type=NotificationType.DELIVERY_UPDATE,
                         title="출고 대기 15건", message="패킹 완료된 주문 15건이 출고 처리 대기 중입니다."),
            Notification(user_id=worker.id, type=NotificationType.ORDER_RECEIVED,
                         title="출고 완료 처리 필요", message="패킹 완료된 주문이 있습니다. 출고 처리해주세요.", is_read=True),
        ]
    db.add_all(notifications)
    db.commit()
    print("✅ Seed notifications created.")


def seed_chat(db):
    if db.query(ChatRoom).count() > 0:
        return
    admin = db.query(User).filter(User.email == "admin@fullfit.com").first()
    if not admin:
        return

    today_str = datetime.now().strftime("%Y%m%d")
    now = datetime.utcnow()

    def _room(seller_u, room_type, ref, hrs_ago, messages):
        r = ChatRoom(room_type=room_type, reference_id=ref,
                     seller_id=seller_u.id, admin_id=admin.id,
                     last_message_at=now - timedelta(hours=hrs_ago))
        db.add(r); db.flush()
        for offset_h, sender_id, msg, is_read in messages:
            db.add(ChatMessage(room_id=r.id, sender_id=sender_id,
                               message=msg, created_at=now - timedelta(hours=offset_h),
                               is_read=is_read))
        r.last_message = messages[-1][2]

    # ── 달바: ORDER room ──────────────────────────────────────────────────────
    dalba = db.query(User).filter(User.email == "dalba@fullfit.com").first()
    if dalba:
        order_num = f"FF-{today_str}-0001"
        _room(dalba, RoomType.ORDER, order_num, 0, [
            (3, dalba.id,  f"안녕하세요, {order_num} 주문 배송이 언제쯤 출발하나요?", True),
            (2, admin.id,  "안녕하세요! 현재 피킹 진행 중이며 내일 출고 예정입니다.", True),
            (1, dalba.id,  "감사합니다. 확인했습니다!", False),
        ])
        # ── 달바: GENERAL room ────────────────────────────────────────────────
        _room(dalba, RoomType.GENERAL, None, 24, [
            (26, dalba.id, "인바운드 신청은 어떻게 하면 되나요?", True),
            (24, admin.id, "재고 관리 메뉴에서 입고 신청 버튼을 클릭하시면 됩니다.", True),
        ])

    # ── 클리오: GENERAL room ──────────────────────────────────────────────────
    clio = db.query(User).filter(User.email == "clio@fullfit.com").first()
    if clio:
        _room(clio, RoomType.GENERAL, None, 5, [
            (7,  clio.id,  "안녕하세요, 재고 조회 관련 문의드립니다.", True),
            (5,  admin.id, "안녕하세요! 어떤 도움이 필요하신가요?", False),
        ])

    # ── 구달: ORDER room ──────────────────────────────────────────────────────
    goodal = db.query(User).filter(User.email == "goodal@fullfit.com").first()
    if goodal:
        _room(goodal, RoomType.GENERAL, None, 8, [
            (10, goodal.id, "출고 일정 변경 요청드립니다.", True),
            (8,  admin.id,  "확인했습니다. 변경 처리해드리겠습니다.", True),
        ])

    # ── 비플레인: GENERAL room ────────────────────────────────────────────────
    bplain = db.query(User).filter(User.email == "bplain@fullfit.com").first()
    if bplain:
        _room(bplain, RoomType.GENERAL, None, 36, [
            (38, bplain.id, "정산 내역 확인 부탁드립니다.", True),
            (36, admin.id,  "2월 정산이 확정되었습니다. 마이페이지에서 확인하세요.", True),
        ])

    db.commit()
    print("✅ Seed chat rooms created (달바×2, 클리오, 구달, 비플레인).")


def seed_demand_history(db):
    """Seed 90 days of brand-specific daily sales per product per channel."""
    if db.query(DemandHistory).count() > 0:
        return

    random.seed(42)
    products = db.query(Product).all()
    today = date.today()
    channels   = ["SMARTSTORE", "CAFE24", "OLIVEYOUNG", "ZIGZAG"]
    weights    = [0.40, 0.25, 0.25, 0.10]
    olly_months = {3, 6, 9, 12}

    # (base_per_day, weekend_mult, seasonal_rules: [(months_set, mult, max_day|None)], skip_common_olly)
    SKU_SPEC = {
        "DAL-001": (12, 1.3, [({6,7,8},          1.8, None)],                         False),
        "DAL-002": (6,  1.2, [({3,4,5},           1.5, None)],                         False),
        "DAL-003": (15, 1.0, [({6,7,8},           2.5, None), ({12,1,2}, 0.5, None)],  False),
        "DAL-004": (10, 1.2, [],                                                        False),
        "CLI-001": (18, 1.0, [({2,3},             2.0, None), ({11,12},  1.8, None)],  False),
        "CLI-002": (16, 1.0, [({2,3},             2.0, None), ({11,12},  1.8, None)],  False),
        "CLI-003": (20, 1.5, [({3,6,9,12},        2.5, 7)],                             True),
        "CLI-004": (25, 1.4, [],                                                        False),
        "CLI-005": (10, 1.0, [({11,12},           2.2, None), ({2,3},    1.8, None)],  False),
        "GOO-001": (22, 1.3, [({6,7,8},           1.5, None)],                         False),
        "GOO-002": (18, 1.0, [({6,7,8},           2.0, None)],                         False),
        "GOO-003": (8,  1.0, [({9,10,11},         1.8, None)],                         False),
        "GOO-004": (15, 1.0, [],                                                        False),
        "BPL-001": (12, 1.2, [],                                                        False),
        "BPL-002": (9,  1.0, [({3,4,5,9,10,11},  1.5, None)],                          False),
        "BPL-003": (8,  1.0, [({12,1,2},          1.8, None)],                         False),
        "BBI-001": (28, 1.0, [({11,12},           2.5, None), ({2},      2.0, None)],  False),
        "BBI-002": (25, 1.0, [({3,4,5,6,7,8},    1.8, None)],                          False),
        "BBI-003": (18, 1.0, [({2,3},             1.6, None)],                          False),
        "BBI-004": (12, 1.0, [({11,12},           2.0, None)],                          False),
        "SKF-001": (10, 1.3, [],                                                        False),
        "SKF-002": (8,  1.0, [({6,7,8},           1.5, None)],                         False),
        "SKF-003": (9,  1.0, [({12,1,2},          1.6, None)],                         False),
        "SKF-004": (5,  1.0, [({12,1,2},          1.8, None)],                         False),
    }

    records = []
    for p in products:
        spec = SKU_SPEC.get(p.sku, (10, 1.2, [], False))
        base, weekend_mult, seasonal, skip_olly = spec

        for offset in range(89, -1, -1):
            d = today - timedelta(days=offset)
            qty = float(base)

            # Brand-specific seasonal multiplier (first matching rule only)
            for months, mult, max_day in seasonal:
                if d.month in months and (max_day is None or d.day <= max_day):
                    qty *= mult
                    break

            # Weekend multiplier
            if d.weekday() in (5, 6):
                qty *= weekend_mult

            # Common 올영세일 boost: first 7 days of 3,6,9,12 months
            if not skip_olly and d.month in olly_months and d.day <= 7:
                qty *= 1.5

            # Random noise ±25%
            qty *= random.uniform(0.75, 1.25)

            # 10% stockout simulation
            if random.random() < 0.10:
                qty = 0.0

            total = round(qty)
            if total == 0:
                continue

            for ch, w in zip(channels, weights):
                ch_qty = round(total * w)
                if ch_qty > 0:
                    records.append(DemandHistory(
                        product_id=p.id, date=d, quantity_sold=ch_qty, channel=ch,
                    ))

    db.add_all(records)
    db.commit()
    print(f"✅ Seed demand_history created ({len(records)} records).")


def seed_vrp_deliveries(db):
    """Seed IN_TRANSIT deliveries across Korean cities for VRP visualization."""
    if db.query(Delivery).filter(Delivery.tracking_number.like("VRP%")).count() > 0:
        return

    seller = db.query(User).filter(User.email == "dalba@fullfit.com").first()
    if not seller:
        return
    products = db.query(Product).filter(Product.seller_id == seller.id).all()
    if not products:
        return

    demo = [
        ("서울 강남구 테헤란로 123",     "박서준", Carrier.CJ,     37.5172, 127.0473),
        ("서울 마포구 홍대입구로 77",     "김예지", Carrier.HANJIN, 37.5663, 126.9014),
        ("경기 성남시 분당구 판교로 8",   "이민호", Carrier.CJ,     37.4449, 127.1388),
        ("경기 수원시 영통구 광교로 22",  "최지우", Carrier.LOTTE,  37.2636, 127.0286),
        ("인천 연수구 송도대로 100",      "장동건", Carrier.ROSEN,  37.4016, 126.6753),
        ("경기 고양시 일산서구 킨텍스로", "손예진", Carrier.CJ,     37.6584, 126.8320),
        ("경기 부천시 원미구 부천로 198", "오정세", Carrier.LOTTE,  37.4989, 126.7831),
        ("서울 영등포구 여의대방로 32",   "신민아", Carrier.CJ,     37.5264, 126.8962),
    ]

    today_str = datetime.now().strftime("%Y%m%d")
    for i, (addr, name, carrier, lat, lng) in enumerate(demo):
        order_num = f"FF-VRP-{today_str}-{i+1:04d}"
        o = Order(
            order_number=order_num, channel=OrderChannel.SMARTSTORE,
            seller_id=seller.id, status=OrderStatus.SHIPPED,
            receiver_name=name,
            receiver_phone=f"010-{1000+i:04d}-{2000+i:04d}",
            receiver_address=addr, total_amount=Decimal("30000"),
            created_at=datetime.utcnow(),
        )
        db.add(o); db.flush()
        db.add(OrderItem(order_id=o.id, product_id=products[i % len(products)].id,
                         quantity=1, unit_price=Decimal("30000")))
        lat_off = ((i * 7 + 3)  % 200 - 100) / 10_000.0
        lng_off = ((i * 13 + 7) % 200 - 100) / 10_000.0
        db.add(Delivery(
            order_id=o.id,
            tracking_number=f"VRP{today_str}{i+1:04d}",
            carrier=carrier, status=DeliveryStatus.IN_TRANSIT,
            estimated_delivery=date.today() + timedelta(days=1),
            delivery_lat=round(lat + lat_off, 4),
            delivery_lng=round(lng + lng_off, 4),
        ))

    db.commit()
    print("✅ VRP demo deliveries seeded.")


def seed_inbound_schedules(db):
    """Seed inbound requests with REQUESTED status scheduled for tomorrow."""
    if db.query(InboundSchedule).count() > 0:
        return

    tomorrow = date.today() + timedelta(days=1)
    now = datetime.utcnow()

    users    = {u.email: u for u in db.query(User).all()}
    products = {p.sku: p  for p in db.query(Product).all()}

    # (email, sku, qty, note, time_slot, dock)
    demos = [
        ("dalba@fullfit.com",    "DAL-001", 100, "달바 스프레이 세럼 100개 입고 예정",      "09:00-10:00", 1),
        ("clio@fullfit.com",     "CLI-001", 200, "클리오 킬커버 쿠션 21호 200개 입고 예정", "10:00-11:00", 2),
        ("goodal@fullfit.com",   "GOO-001", 150, "구달 청귤 비타C 세럼 150개 입고 예정",    "11:00-12:00", 1),
        ("bplain@fullfit.com",   "BPL-002",  80, "비플레인 판테놀 세럼 80개 입고 예정",     "13:00-14:00", 1),
        ("bbia@fullfit.com",     "BBI-001", 120, "삐아 립틴트 레드빈 120개 입고 예정",      "14:00-15:00", 2),
        ("skinfood@fullfit.com", "SKF-001",  60, "스킨푸드 블랙슈가 스크럽 60개 입고 예정", "15:00-16:00", 1),
    ]

    added = 0
    for email, sku, qty, note, time_slot, dock in demos:
        seller_u = users.get(email)
        prod     = products.get(sku)
        if not seller_u or not prod:
            continue

        inb = Inbound(
            product_id=prod.id,
            lot_number=f"REQ-{sku}-{tomorrow.strftime('%Y%m%d')}",
            expiry_date=date(2027, 6, 30),
            quantity=qty,
            inbound_date=tomorrow,
            note=note,
            created_by=seller_u.id,
            created_at=now - timedelta(hours=added),
        )
        db.add(inb); db.flush()

        db.add(InboundSchedule(
            inbound_id=inb.id,
            seller_id=seller_u.id,
            scheduled_date=tomorrow,
            time_slot=time_slot,
            dock_number=dock,
            priority_score=round(qty / 100.0, 2),
            priority_reason=note,
            status="REQUESTED",
        ))
        added += 1

    db.commit()
    print(f"✅ Seed inbound schedules (REQUESTED) created ({added} entries).")


_STATUS_LABELS_KR = {
    "RECEIVED":  "주문 접수",
    "PICKING":   "출고 준비중",
    "PACKED":    "패킹 완료",
    "SHIPPED":   "출고 완료",
    "DELIVERED": "배송 완료",
    "CANCELLED": "취소",
}


def seed_order_histories(db):
    """Seed realistic progression histories for all seeded orders."""
    if db.query(OrderHistory).count() > 0:
        return

    admin_user  = db.query(User).filter(User.email == "admin@fullfit.com").first()
    worker_user = db.query(User).filter(User.email == "worker@fullfit.com").first()

    PROGRESSION = ["RECEIVED", "PICKING", "PACKED", "SHIPPED", "DELIVERED"]
    histories = []

    for order in db.query(Order).all():
        status = order.status.value
        created = order.created_at or datetime.utcnow()

        if status == "CANCELLED":
            chain = ["RECEIVED", "CANCELLED"]
        elif status in PROGRESSION:
            idx = PROGRESSION.index(status)
            chain = PROGRESSION[:idx + 1]
        else:
            chain = ["RECEIVED"]

        for i, s in enumerate(chain):
            ts = created + timedelta(hours=i * 2 + random.randint(0, 1))
            if i == 0:
                histories.append(OrderHistory(
                    order_id=order.id,
                    changed_by_name="자동 시뮬레이터",
                    field_changed="status",
                    old_value=None,
                    new_value="주문 접수",
                    note="주문 자동 접수",
                    created_at=ts,
                ))
            else:
                prev_s = chain[i - 1]
                if s == "PICKING" and admin_user:
                    by_name = f"{admin_user.full_name} (관리자)"
                elif s == "PACKED" and worker_user:
                    by_name = f"{worker_user.full_name} (작업자)"
                else:
                    by_name = "자동 시뮬레이터"
                histories.append(OrderHistory(
                    order_id=order.id,
                    changed_by_name=by_name,
                    field_changed="status",
                    old_value=_STATUS_LABELS_KR.get(prev_s),
                    new_value=_STATUS_LABELS_KR.get(s),
                    created_at=ts,
                ))

    db.add_all(histories)
    db.commit()
    print(f"✅ Seed order histories created ({len(histories)} records).")


def seed_order_issues(db):
    """Seed 8 demo issues covering various types and priorities."""
    if db.query(OrderIssue).count() > 0:
        return

    sellers = {u.email: u for u in db.query(User).filter(User.role == UserRole.SELLER).all()}
    now = datetime.utcnow()

    def s(email):
        u = sellers.get(email)
        return u.id if u else None

    issues = [
        OrderIssue(seller_id=s("goodal@fullfit.com"),   issue_type="STOCK_SHORTAGE",  priority="HIGH",     status="OPEN",        title="구달 청귤비타C세럼 재고 부족으로 출고 보류",          description="구달 청귤 비타C 잡티세럼 (GOO-001) 재고 8개 남음. 15건 주문 대기 중이나 재고 부족으로 출고 불가. 긴급 보충 필요.",          assigned_to="김철수",   created_at=now-timedelta(days=2),  updated_at=now-timedelta(days=2)),
        OrderIssue(seller_id=s("clio@fullfit.com"),     issue_type="ADDRESS_ERROR",   priority="HIGH",     status="OPEN",        title="클리오 쿠션 주문 주소 오류 - 상세주소 없음",            description="클리오 킬커버 쿠션 21호 주문 3건에서 수신자 주소에 상세주소(동호수)가 누락됨. 배송 불가 상태.",                           assigned_to="이영희",   created_at=now-timedelta(days=1),  updated_at=now-timedelta(days=1)),
        OrderIssue(seller_id=s("skinfood@fullfit.com"), issue_type="EXPIRY_HOLD",     priority="CRITICAL", status="IN_PROGRESS", title="스킨푸드 블랙슈가 스크럽 유통기한 임박 출고 보류",       description="스킨푸드 블랙슈가 퍼펙트 스크럽 2X (SKF-001) 유통기한 7일 이내 임박. 해당 LOT 출고 전 셀러 확인 필요. 현재 출고 보류 중.", assigned_to="김철수",   created_at=now-timedelta(days=3),  updated_at=now-timedelta(hours=6)),
        OrderIssue(seller_id=s("dalba@fullfit.com"),    issue_type="RETURN_DELAY",    priority="NORMAL",   status="OPEN",        title="달바 세럼 반품 회수 5일 경과",                          description="달바 화이트트러플 스프레이 세럼 반품 요청 후 택배사 회수가 5일째 지연. 택배사(CJ대한통운) 재수거 요청 필요.",              assigned_to=None,      created_at=now-timedelta(days=5),  updated_at=now-timedelta(days=5)),
        OrderIssue(seller_id=s("bbia@fullfit.com"),     issue_type="COURIER_ERROR",   priority="HIGH",     status="IN_PROGRESS", title="삐아 립틴트 택배 분실 의심",                            description="삐아 라스트 립틴트 OR01 레드빈 배송 건 - 발송 후 7일 경과했으나 배송 완료 처리 안됨. 고객 미수령 신고. 택배사 분실 조사 중.", assigned_to="김철수",   created_at=now-timedelta(days=7),  updated_at=now-timedelta(days=1)),
        OrderIssue(seller_id=s("bplain@fullfit.com"),   issue_type="DAMAGE",          priority="NORMAL",   status="RESOLVED",    title="비플레인 클렌징폼 파손 발견",                            description="비플레인 약산성 클렌징폼 (BPL-001) 입고 시 일부 제품 용기 파손 확인 (15개 중 3개). 파손품 격리 처리 완료.",              assigned_to="이영희",   created_at=now-timedelta(days=4),  updated_at=now-timedelta(days=1),  resolved_at=now-timedelta(days=1),  resolution_note="파손 상품 3개 격리 후 반품 처리. 정상 상품 12개 입고 완료."),
        OrderIssue(seller_id=s("clio@fullfit.com"),     issue_type="DUPLICATE_ORDER", priority="NORMAL",   status="RESOLVED",    title="클리오 아이라이너 중복 주문 발견",                       description="동일 고객이 10분 간격으로 동일 상품(CLI-004) 2건 주문. 고객 확인 후 1건 취소 처리.",                                       assigned_to="김철수",   created_at=now-timedelta(days=1),  updated_at=now-timedelta(hours=12), resolved_at=now-timedelta(hours=12), resolution_note="고객 확인 결과 실수 주문. 1건 취소 처리 완료."),
        OrderIssue(seller_id=s("goodal@fullfit.com"),   issue_type="STOCK_SHORTAGE",  priority="CRITICAL", status="OPEN",        title="구달 흑당근 레티놀 앰플 재고 소진 임박",                 description="구달 흑당근 레티놀 탄력 앰플 (GOO-003) 현재 재고 8개. 일평균 판매량 대비 2-3일 내 재고 소진 예상. 즉시 보충 입고 요청 필요.", assigned_to="김철수",   created_at=now-timedelta(hours=12), updated_at=now-timedelta(hours=12)),
    ]

    db.add_all(issues)
    db.commit()
    print(f"✅ Seed order issues created ({len(issues)} records).")


# ── Background: order simulator ────────────────────────────────────────────────

async def order_simulator():
    """Every 30 s: create new RECEIVED orders. Staggered progression via cycle counter.
    Cycle rates: RECEIVED→PICKING every 2nd, PICKING→PACKED every 3rd,
    PACKED→SHIPPED every 4th, SHIPPED→DELIVERED every 6th.
    """
    _SIM_NAMES  = ['김민지', '이수진', '박지현', '최유리', '정하나', '한예슬', '오지민', '김예린']
    _SIM_ADDRS  = ['서울 강남구', '부산 해운대구', '경기 성남시', '인천 연수구', '대전 유성구', '대구 수성구']
    _SIM_CHANS  = [OrderChannel.SMARTSTORE, OrderChannel.OLIVEYOUNG, OrderChannel.ZIGZAG, OrderChannel.CAFE24]

    await asyncio.sleep(10)   # let startup finish first
    cycle = 0
    while True:
        cycle += 1
        db = SessionLocal()
        try:
            sellers = db.query(User).filter(User.role == UserRole.SELLER).all()
            if not sellers:
                await asyncio.sleep(30)
                continue

            # 1. Create 2-3 new RECEIVED orders each cycle
            n_new = random.randint(2, 3)
            for _ in range(n_new):
                seller = random.choice(sellers)
                prods  = db.query(Product).filter(Product.seller_id == seller.id).all()
                order_number = (
                    f"FF-{datetime.now().strftime('%Y%m%d')}-{int(time.time() * 1000) % 100000:05d}"
                )
                amount = random.randint(15, 85) * 1000
                new_o = Order(
                    order_number=order_number,
                    channel=random.choice(_SIM_CHANS),
                    seller_id=seller.id,
                    status=OrderStatus.RECEIVED,
                    receiver_name=random.choice(_SIM_NAMES),
                    receiver_phone=f"010-{random.randint(1000,9999)}-{random.randint(1000,9999)}",
                    receiver_address=random.choice(_SIM_ADDRS),
                    total_amount=Decimal(str(amount)),
                )
                db.add(new_o); db.flush()
                if prods:
                    prod = random.choice(prods)
                    unit_price = _PRODUCT_PRICES.get(prod.sku, amount)
                    db.add(OrderItem(order_id=new_o.id, product_id=prod.id,
                                     quantity=1, unit_price=Decimal(str(unit_price))))
                print(f"[Simulator] 📦 NEW {order_number} (RECEIVED)")

            # 2. RECEIVED → PICKING every 2nd cycle
            if cycle % 2 == 0:
                received_orders = (
                    db.query(Order).filter(Order.status == OrderStatus.RECEIVED)
                    .order_by(Order.created_at.asc()).limit(2).all()
                )
                for o in received_orders:
                    o.status = OrderStatus.PICKING
                    db.add(OrderHistory(order_id=o.id, changed_by_name="자동 시뮬레이터",
                                        field_changed="status", old_value="주문 접수", new_value="출고 준비중"))
                    print(f"[Simulator] 🔄 {o.order_number}: RECEIVED → PICKING")

            # 3. PICKING → PACKED every 3rd cycle
            if cycle % 3 == 0:
                picking_orders = (
                    db.query(Order).filter(Order.status == OrderStatus.PICKING)
                    .order_by(Order.created_at.asc()).limit(2).all()
                )
                for o in picking_orders:
                    o.status = OrderStatus.PACKED
                    db.add(OrderHistory(order_id=o.id, changed_by_name="자동 시뮬레이터",
                                        field_changed="status", old_value="출고 준비중", new_value="패킹 완료"))
                    print(f"[Simulator] 📦 {o.order_number}: PICKING → PACKED")

            # 4. PACKED → SHIPPED every 4th cycle
            if cycle % 4 == 0:
                packed_orders = (
                    db.query(Order).filter(Order.status == OrderStatus.PACKED)
                    .order_by(Order.created_at.asc()).limit(2).all()
                )
                for o in packed_orders:
                    existing = db.query(Delivery).filter(Delivery.order_id == o.id).first()
                    if not existing:
                        o.status = OrderStatus.SHIPPED
                        courier = _pick(_COURIERS, _COURIER_W)
                        db.add(Delivery(
                            order_id=o.id,
                            tracking_number=_tracking_number(courier),
                            carrier=courier,
                            status=DeliveryStatus.IN_TRANSIT,
                            estimated_delivery=date.today() + timedelta(days=1),
                        ))
                        db.add(OrderHistory(order_id=o.id, changed_by_name="자동 시뮬레이터",
                                            field_changed="status", old_value="패킹 완료", new_value="출고 완료"))
                        print(f"[Simulator] 🚚 {o.order_number}: PACKED → SHIPPED ({courier.value})")

            # 5. SHIPPED → DELIVERED every 6th cycle
            if cycle % 6 == 0:
                shipped_orders = (
                    db.query(Order)
                    .join(Delivery, Delivery.order_id == Order.id)
                    .filter(Order.status == OrderStatus.SHIPPED,
                            Delivery.status == DeliveryStatus.IN_TRANSIT)
                    .order_by(Order.created_at.asc())
                    .limit(2).all()
                )
                for o in shipped_orders:
                    o.status = OrderStatus.DELIVERED
                    d = db.query(Delivery).filter(Delivery.order_id == o.id).first()
                    if d:
                        d.status = DeliveryStatus.DELIVERED
                        d.actual_delivery = date.today()
                    db.add(OrderHistory(order_id=o.id, changed_by_name="자동 시뮬레이터",
                                        field_changed="status", old_value="출고 완료", new_value="배송 완료"))
                    print(f"[Simulator] ✅ {o.order_number}: SHIPPED → DELIVERED")

            db.commit()
        except Exception as e:
            print(f"[simulator] error: {e}")
            try:
                db.rollback()
            except Exception:
                pass
        finally:
            db.close()
        await asyncio.sleep(30)


# ── Startup ────────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    # Step 0: Force clean DB reset
    print("🗑️  Dropping all tables for clean reset...")
    Base.metadata.drop_all(bind=engine)
    print("🏗️  Recreating all tables...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        seed_users(db)
        seed_products(db)
        seed_orders_large(db)
        seed_settlements(db)
        seed_returns(db)
        seed_promotions(db)
        seed_notifications(db)
        seed_chat(db)
        seed_demand_history(db)
        seed_vrp_deliveries(db)
        seed_inbound_schedules(db)
        seed_order_histories(db)
        seed_order_issues(db)
    finally:
        db.close()

    asyncio.create_task(order_simulator())
    print("🚀 FullFit API ready — simulator started.")


@app.get("/")
def root():
    return {"message": "FullFit API is running"}
