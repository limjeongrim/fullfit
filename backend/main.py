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
from backend.core.security import hash_password
from backend.routers import auth, inventory, order, delivery, settlement, stats
from backend.routers import return_request, channel_sync, promotion, notification, seller_management, chat

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


# ── Seed helpers ───────────────────────────────────────────────────────────────

def seed_users(db):
    if db.query(User).count() > 0:
        return
    users = [
        User(email="admin@fullfit.com", hashed_password=hash_password("admin1234"),
             role=UserRole.ADMIN, full_name="김철수", joined_at=datetime(2025, 1, 1)),
        User(email="worker@fullfit.com", hashed_password=hash_password("worker1234"),
             role=UserRole.WORKER, full_name="이영희", joined_at=datetime(2025, 1, 1)),
        User(email="seller@fullfit.com", hashed_password=hash_password("seller1234"),
             role=UserRole.SELLER, full_name="홍길동",
             company_name="길동뷰티", business_number="000-00-00001",
             joined_at=datetime(2025, 6, 1)),
        User(email="seller2@fullfit.com", hashed_password=hash_password("seller1234"),
             role=UserRole.SELLER, full_name="김미래",
             company_name="미래코스메틱", business_number="123-45-67891",
             joined_at=datetime(2025, 9, 15)),
        User(email="seller3@fullfit.com", hashed_password=hash_password("seller1234"),
             role=UserRole.SELLER, full_name="박준호",
             company_name="준호뷰티", business_number="987-65-43210",
             joined_at=datetime(2026, 1, 20)),
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

    now = datetime.utcnow()
    created_at_map = {
        1: now - timedelta(days=6),
        2: now - timedelta(days=6),
        3: now - timedelta(days=4),
        4: now - timedelta(days=4),
        5: now - timedelta(days=3),
        6: now - timedelta(days=3),
        7: now - timedelta(days=2),
        8: now - timedelta(days=2),
        9: now,
        10: now,
    }
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
            created_at=created_at_map[seq],
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


def seed_returns(db):
    if db.query(ReturnRequest).count() > 0:
        return
    seller = db.query(User).filter(User.email == "seller@fullfit.com").first()
    if not seller:
        return
    delivered = (
        db.query(Order)
        .filter(Order.seller_id == seller.id, Order.status == OrderStatus.DELIVERED)
        .all()
    )
    if len(delivered) < 2:
        return
    returns = [
        ReturnRequest(
            order_id=delivered[0].id,
            seller_id=seller.id,
            reason=ReturnReason.DEFECTIVE,
            status=ReturnStatus.IN_REVIEW,
            note="제품 불량으로 인한 반품 요청입니다.",
            inspection_note="검수 진행 중",
        ),
        ReturnRequest(
            order_id=delivered[1].id,
            seller_id=seller.id,
            reason=ReturnReason.CHANGE_OF_MIND,
            status=ReturnStatus.REQUESTED,
            note="단순 변심으로 반품합니다.",
        ),
    ]
    db.add_all(returns)
    db.commit()
    print("✅ Seed returns created.")


def seed_extra_sellers(db):
    """Seed inventory + orders for seller2 and seller3."""
    seller2 = db.query(User).filter(User.email == "seller2@fullfit.com").first()
    seller3 = db.query(User).filter(User.email == "seller3@fullfit.com").first()
    if not seller2 or not seller3:
        return
    if db.query(Product).filter(Product.seller_id == seller2.id).count() > 0:
        return

    # Seller2 products
    ps2_1 = Product(seller_id=seller2.id, name="립스틱 레드", sku="LIP-001",
                    barcode="8809000000001", category="색조", storage_type=StorageType.ROOM_TEMP)
    ps2_2 = Product(seller_id=seller2.id, name="아이섀도우 팔레트", sku="EYE-001",
                    barcode="8809000000002", category="색조", storage_type=StorageType.ROOM_TEMP)
    db.add_all([ps2_1, ps2_2])

    # Seller3 products
    ps3_1 = Product(seller_id=seller3.id, name="클렌징폼", sku="CLN-001",
                    barcode="8809000000003", category="클렌징", storage_type=StorageType.ROOM_TEMP)
    ps3_2 = Product(seller_id=seller3.id, name="토너패드", sku="TON-001",
                    barcode="8809000000004", category="스킨케어", storage_type=StorageType.ROOM_TEMP)
    db.add_all([ps3_1, ps3_2])
    db.flush()

    # Inventory for seller2
    db.add_all([
        Inventory(product_id=ps2_1.id, lot_number="LOT-S2-001",
                  expiry_date=date(2027, 1, 1), quantity=100, inbound_date=date(2026, 2, 1)),
        Inventory(product_id=ps2_2.id, lot_number="LOT-S2-002",
                  expiry_date=date(2027, 1, 1), quantity=100, inbound_date=date(2026, 2, 1)),
    ])

    # Inventory for seller3
    db.add_all([
        Inventory(product_id=ps3_1.id, lot_number="LOT-S3-001",
                  expiry_date=date(2026, 8, 1), quantity=80, inbound_date=date(2026, 2, 15)),
        Inventory(product_id=ps3_2.id, lot_number="LOT-S3-002",
                  expiry_date=date(2026, 8, 1), quantity=80, inbound_date=date(2026, 2, 15)),
    ])
    db.flush()

    today = datetime.now().strftime("%Y%m%d")
    now = datetime.utcnow()

    # 5 orders for seller2
    s2_orders = [
        (OrderChannel.SMARTSTORE,  OrderStatus.RECEIVED,  "강다현", "010-1111-2222", "서울 강북구", Decimal("38000"), ps2_1),
        (OrderChannel.OLIVEYOUNG,  OrderStatus.PICKING,   "윤서준", "010-2222-3333", "경기 수원시", Decimal("55000"), ps2_2),
        (OrderChannel.CAFE24,      OrderStatus.SHIPPED,   "임채영", "010-3333-4444", "부산 연제구", Decimal("42000"), ps2_1),
        (OrderChannel.ZIGZAG,      OrderStatus.DELIVERED, "정유진", "010-4444-5555", "인천 남동구", Decimal("60000"), ps2_2),
        (OrderChannel.SMARTSTORE,  OrderStatus.DELIVERED, "최민석", "010-5555-6666", "대구 달서구", Decimal("32000"), ps2_1),
    ]
    for seq, (ch, st, rname, rphone, raddr, amount, prod) in enumerate(s2_orders, start=1):
        o = Order(
            order_number=f"FF-{today}-S2-{seq:04d}",
            channel=ch, seller_id=seller2.id, status=st,
            receiver_name=rname, receiver_phone=rphone, receiver_address=raddr,
            total_amount=amount, created_at=now - timedelta(days=seq),
        )
        db.add(o)
        db.flush()
        db.add(OrderItem(order_id=o.id, product_id=prod.id, quantity=1, unit_price=amount))

    # 3 orders for seller3
    s3_orders = [
        (OrderChannel.SMARTSTORE,  OrderStatus.RECEIVED,  "한주원", "010-6666-7777", "광주 북구",   Decimal("22000"), ps3_1),
        (OrderChannel.CAFE24,      OrderStatus.PICKING,   "오세진", "010-7777-8888", "대전 유성구", Decimal("35000"), ps3_2),
        (OrderChannel.OLIVEYOUNG,  OrderStatus.DELIVERED, "신민아", "010-8888-9999", "울산 중구",   Decimal("48000"), ps3_1),
    ]
    for seq, (ch, st, rname, rphone, raddr, amount, prod) in enumerate(s3_orders, start=1):
        o = Order(
            order_number=f"FF-{today}-S3-{seq:04d}",
            channel=ch, seller_id=seller3.id, status=st,
            receiver_name=rname, receiver_phone=rphone, receiver_address=raddr,
            total_amount=amount, created_at=now - timedelta(days=seq + 2),
        )
        db.add(o)
        db.flush()
        db.add(OrderItem(order_id=o.id, product_id=prod.id, quantity=1, unit_price=amount))

    db.commit()
    print("✅ Seed extra sellers created.")


def seed_promotions(db):
    if db.query(Promotion).count() > 0:
        return
    promos = [
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
    ]
    db.add_all(promos)
    db.commit()
    print("✅ Seed promotions created.")


def seed_notifications(db):
    if db.query(Notification).count() > 0:
        return
    admin = db.query(User).filter(User.email == "admin@fullfit.com").first()
    worker = db.query(User).filter(User.email == "worker@fullfit.com").first()
    seller = db.query(User).filter(User.email == "seller@fullfit.com").first()
    if not admin or not seller:
        return
    notifications = [
        # Admin notifications
        Notification(user_id=admin.id, type=NotificationType.ORDER_RECEIVED,
                     title="새 주문 접수", message="주문번호 FF-20260317-0009 (CAFE24) 접수되었습니다."),
        Notification(user_id=admin.id, type=NotificationType.STOCK_LOW,
                     title="재고 부족: 비타민C 앰플", message="비타민C 앰플 (SKN-002) 재고가 50개로 부족합니다."),
        Notification(user_id=admin.id, type=NotificationType.EXPIRY_ALERT,
                     title="유통기한 임박 경고", message="비타민C 앰플 LOT-2024-003 유통기한이 8일 남았습니다."),
        Notification(user_id=admin.id, type=NotificationType.PROMOTION_ALERT,
                     title="프로모션 D-39: 올영데이", message="올리브영 올영데이가 39일 후 시작됩니다. 재고를 미리 확보하세요."),
        Notification(user_id=admin.id, type=NotificationType.SETTLEMENT_READY,
                     title="2026-02 정산 확정", message="홍길동 셀러의 2026-02 정산이 확정되었습니다.", is_read=True),
        # Seller notifications
        Notification(user_id=seller.id, type=NotificationType.ORDER_RECEIVED,
                     title="새 주문이 들어왔습니다", message="스마트스토어에서 새 주문이 접수되었습니다."),
        Notification(user_id=seller.id, type=NotificationType.DELIVERY_UPDATE,
                     title="배송 상태 변경: 배송중", message="주문 FF-20260317-0006 배송이 [배송중] 상태로 변경되었습니다."),
        Notification(user_id=seller.id, type=NotificationType.SETTLEMENT_READY,
                     title="2026-02 정산 확정", message="2026-02 정산이 확정되었습니다. 총 정산금액: ₩132,000"),
        Notification(user_id=seller.id, type=NotificationType.STOCK_LOW,
                     title="재고 부족: 비타민C 앰플", message="비타민C 앰플 (SKN-002) 재고가 50개로 부족합니다."),
        Notification(user_id=seller.id, type=NotificationType.PROMOTION_ALERT,
                     title="프로모션 예정: 올영데이", message="올영데이가 39일 후 시작됩니다. 재고를 미리 확보하세요.", is_read=True),
    ]
    if worker:
        notifications += [
            Notification(user_id=worker.id, type=NotificationType.ORDER_RECEIVED,
                         title="새 피킹 작업 배정", message="주문 3건이 피킹 대기 중입니다."),
            Notification(user_id=worker.id, type=NotificationType.EXPIRY_ALERT,
                         title="유통기한 임박 상품 입고됨", message="비타민C 앰플 LOT-2024-003 유통기한이 8일 남았습니다."),
            Notification(user_id=worker.id, type=NotificationType.STOCK_LOW,
                         title="재고 부족 경고", message="비타민C 앰플 재고가 50개 미만입니다."),
            Notification(user_id=worker.id, type=NotificationType.DELIVERY_UPDATE,
                         title="출고 대기 2건", message="패킹 완료된 주문 2건이 출고 처리 대기 중입니다."),
            Notification(user_id=worker.id, type=NotificationType.ORDER_RECEIVED,
                         title="출고 완료 처리 필요", message="패킹 완료된 주문이 있습니다. 출고 처리해주세요.", is_read=True),
        ]
    db.add_all(notifications)
    db.commit()
    print("✅ Seed notifications created.")


def seed_chat(db):
    if db.query(ChatRoom).count() > 0:
        return
    seller = db.query(User).filter(User.email == "seller@fullfit.com").first()
    admin = db.query(User).filter(User.email == "admin@fullfit.com").first()
    if not seller or not admin:
        return

    today = datetime.now().strftime("%Y%m%d")
    order_number = f"FF-{today}-0001"

    now = datetime.utcnow()

    # Room 1: ORDER type linked to first order
    room1 = ChatRoom(
        room_type=RoomType.ORDER,
        reference_id=order_number,
        seller_id=seller.id,
        admin_id=admin.id,
        last_message_at=now,
    )
    db.add(room1)
    db.flush()

    msgs1 = [
        ChatMessage(room_id=room1.id, sender_id=seller.id,
                    message=f"안녕하세요, {order_number} 주문 배송이 언제쯤 출발하나요?",
                    created_at=now - timedelta(hours=3), is_read=True),
        ChatMessage(room_id=room1.id, sender_id=admin.id,
                    message="안녕하세요! 현재 피킹 진행 중이며 내일 출고 예정입니다.",
                    created_at=now - timedelta(hours=2), is_read=True),
        ChatMessage(room_id=room1.id, sender_id=seller.id,
                    message="감사합니다. 확인했습니다!",
                    created_at=now - timedelta(hours=1), is_read=False),
    ]
    db.add_all(msgs1)
    room1.last_message = msgs1[-1].message

    # Room 2: GENERAL type
    room2 = ChatRoom(
        room_type=RoomType.GENERAL,
        reference_id=None,
        seller_id=seller.id,
        admin_id=admin.id,
        last_message_at=now - timedelta(days=1),
    )
    db.add(room2)
    db.flush()

    msgs2 = [
        ChatMessage(room_id=room2.id, sender_id=seller.id,
                    message="인바운드 신청은 어떻게 하면 되나요?",
                    created_at=now - timedelta(days=1, hours=2), is_read=True),
        ChatMessage(room_id=room2.id, sender_id=admin.id,
                    message="재고 관리 메뉴에서 입고 신청 버튼을 클릭하시면 됩니다.",
                    created_at=now - timedelta(days=1), is_read=True),
    ]
    db.add_all(msgs2)
    room2.last_message = msgs2[-1].message

    db.commit()
    print("✅ Seed chat rooms created.")


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
        seed_returns(db)
        seed_extra_sellers(db)
        seed_promotions(db)
        seed_notifications(db)
        seed_chat(db)
    finally:
        db.close()


@app.get("/")
def root():
    return {"message": "FullFit API is running"}
