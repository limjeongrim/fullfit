from datetime import date, datetime
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
from backend.core.security import hash_password
from backend.routers import auth, inventory, order, delivery, settlement, stats

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


# ── Seed helpers ───────────────────────────────────────────────────────────────

def seed_users(db):
    if db.query(User).count() > 0:
        return
    users = [
        User(email="admin@fullfit.com", hashed_password=hash_password("admin1234"),
             role=UserRole.ADMIN, full_name="김철수"),
        User(email="worker@fullfit.com", hashed_password=hash_password("worker1234"),
             role=UserRole.WORKER, full_name="이영희"),
        User(email="seller@fullfit.com", hashed_password=hash_password("seller1234"),
             role=UserRole.SELLER, full_name="홍길동"),
    ]
    db.add_all(users)
    db.commit()
    print("✅ Seed users created.")


def seed_inventory(db):
    if db.query(Product).count() > 0:
        return

    seller = db.query(User).filter(User.email == "seller@fullfit.com").first()
    if not seller:
        return

    p1 = Product(seller_id=seller.id, name="수분 세럼", sku="SKN-001",
                 barcode="8801234567890", category="스킨케어", storage_type=StorageType.ROOM_TEMP)
    p2 = Product(seller_id=seller.id, name="비타민C 앰플", sku="SKN-002",
                 barcode="8801234567891", category="스킨케어", storage_type=StorageType.COLD)
    p3 = Product(seller_id=seller.id, name="선크림 SPF50", sku="SKN-003",
                 barcode="8801234567892", category="선케어", storage_type=StorageType.ROOM_TEMP)
    db.add_all([p1, p2, p3])
    db.flush()

    lots = [
        Inventory(product_id=p1.id, lot_number="LOT-2024-001",
                  expiry_date=date(2026, 4, 10), quantity=150, inbound_date=date(2026, 1, 10)),
        Inventory(product_id=p1.id, lot_number="LOT-2024-002",
                  expiry_date=date(2026, 12, 31), quantity=300, inbound_date=date(2026, 1, 10)),
        Inventory(product_id=p2.id, lot_number="LOT-2024-003",
                  expiry_date=date(2026, 3, 25), quantity=50, inbound_date=date(2026, 2, 1)),
        Inventory(product_id=p3.id, lot_number="LOT-2024-004",
                  expiry_date=date(2027, 6, 30), quantity=200, inbound_date=date(2026, 3, 1)),
    ]
    db.add_all(lots)
    db.commit()
    print("✅ Seed inventory created.")


def seed_orders(db):
    if db.query(Order).count() > 0:
        return

    seller = db.query(User).filter(User.email == "seller@fullfit.com").first()
    products = db.query(Product).filter(Product.seller_id == seller.id).all()
    if not seller or not products:
        return

    p1, p2, p3 = products[0], products[1], products[2]

    seed_data = [
        # (channel, status, receiver_name, phone, address, amount, product, qty, unit_price)
        (OrderChannel.SMARTSTORE, OrderStatus.RECEIVED,  "김민준", "010-1234-5678", "서울 강남구 테헤란로 123", Decimal("35000"), p1, 2, Decimal("17500")),
        (OrderChannel.SMARTSTORE, OrderStatus.RECEIVED,  "이서연", "010-2345-6789", "서울 서초구 방배로 45",   Decimal("52000"), p2, 1, Decimal("52000")),
        (OrderChannel.SMARTSTORE, OrderStatus.RECEIVED,  "박지후", "010-3456-7890", "경기 성남시 분당구 판교로 8", Decimal("28000"), p3, 2, Decimal("14000")),
        (OrderChannel.OLIVEYOUNG, OrderStatus.PICKING,   "최수아", "010-4567-8901", "서울 마포구 홍대입구로 77",  Decimal("45000"), p1, 1, Decimal("45000")),
        (OrderChannel.OLIVEYOUNG, OrderStatus.PICKING,   "정도윤", "010-5678-9012", "인천 연수구 송도대로 100",   Decimal("60000"), p2, 2, Decimal("30000")),
        (OrderChannel.ZIGZAG,     OrderStatus.SHIPPED,   "한예린", "010-6789-0123", "부산 해운대구 우동로 55",    Decimal("32000"), p3, 1, Decimal("32000")),
        (OrderChannel.ZIGZAG,     OrderStatus.SHIPPED,   "오지민", "010-7890-1234", "대구 수성구 달구벌대로 200", Decimal("70000"), p1, 3, Decimal("23333")),
        (OrderChannel.CAFE24,     OrderStatus.DELIVERED, "신채원", "010-8901-2345", "광주 서구 상무중앙로 30",    Decimal("55000"), p2, 1, Decimal("55000")),
        (OrderChannel.CAFE24,     OrderStatus.DELIVERED, "임태양", "010-9012-3456", "대전 유성구 대학로 99",      Decimal("42000"), p3, 3, Decimal("14000")),
        (OrderChannel.MANUAL,     OrderStatus.CANCELLED, "강하늘", "010-0123-4567", "울산 남구 삼산로 15",        Decimal("25000"), p1, 1, Decimal("25000")),
    ]

    today = datetime.now().strftime("%Y%m%d")
    for seq, (channel, status, rname, rphone, raddr, amount, prod, qty, uprice) in enumerate(seed_data, start=1):
        order_number = f"FF-{today}-{seq:04d}"
        o = Order(
            order_number=order_number,
            channel=channel,
            seller_id=seller.id,
            status=status,
            receiver_name=rname,
            receiver_phone=rphone,
            receiver_address=raddr,
            total_amount=amount,
        )
        db.add(o)
        db.flush()
        db.add(OrderItem(order_id=o.id, product_id=prod.id, quantity=qty, unit_price=uprice))

    db.commit()
    print("✅ Seed orders created.")


def seed_deliveries(db):
    if db.query(Delivery).count() > 0:
        return

    zigzag = db.query(Order).filter(Order.channel == OrderChannel.ZIGZAG).all()
    cafe24  = db.query(Order).filter(Order.channel == OrderChannel.CAFE24).all()
    if len(zigzag) < 2 or len(cafe24) < 2:
        return

    deliveries = [
        Delivery(order_id=zigzag[0].id, tracking_number="CJ202603160001",
                 carrier=Carrier.CJ,     status=DeliveryStatus.IN_TRANSIT,
                 estimated_delivery=date(2026, 3, 18)),
        Delivery(order_id=zigzag[1].id, tracking_number="HJ202603160001",
                 carrier=Carrier.HANJIN, status=DeliveryStatus.IN_TRANSIT,
                 estimated_delivery=date(2026, 3, 19)),
        Delivery(order_id=cafe24[0].id,  tracking_number="CJ202603150001",
                 carrier=Carrier.CJ,     status=DeliveryStatus.DELIVERED,
                 estimated_delivery=date(2026, 3, 16),
                 actual_delivery=date(2026, 3, 16)),
        Delivery(order_id=cafe24[1].id,  tracking_number="LT202603150001",
                 carrier=Carrier.LOTTE,  status=DeliveryStatus.DELIVERED,
                 estimated_delivery=date(2026, 3, 16),
                 actual_delivery=date(2026, 3, 16)),
    ]
    db.add_all(deliveries)
    db.commit()
    print("✅ Seed deliveries created.")


def seed_settlements(db):
    if db.query(Settlement).count() > 0:
        return
    seller = db.query(User).filter(User.email == "seller@fullfit.com").first()
    if not seller:
        return
    s = Settlement(
        seller_id=seller.id,
        year_month="2026-02",
        storage_fee=Decimal("75000"),
        inbound_fee=Decimal("9000"),
        outbound_fee=Decimal("48000"),
        extra_fee=Decimal("0"),
        total_fee=Decimal("132000"),
        status=SettlementStatus.CONFIRMED,
        confirmed_at=datetime(2026, 3, 1),
    )
    db.add(s)
    db.commit()
    print("✅ Seed settlement created.")


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_users(db)
        seed_inventory(db)
        seed_orders(db)
        seed_deliveries(db)
        seed_settlements(db)
    finally:
        db.close()


@app.get("/")
def root():
    return {"message": "FullFit API is running"}
