from datetime import date, timedelta
import os
import httpx
from fastapi import APIRouter, Depends
from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models.user import User, UserRole
from backend.models.product import Product, StorageType
from backend.models.inventory import Inventory
from backend.models.order import Order, OrderStatus
from backend.models.inbound import Inbound
from backend.models.delivery import Delivery, DeliveryStatus
from backend.models.return_request import ReturnRequest, ReturnStatus
from backend.models.order_issue import OrderIssue
from backend.models.promotion import Promotion
from backend.core.dependencies import get_current_user

router = APIRouter(prefix="/ai", tags=["ai"])


async def search_naver(query: str) -> str:
    import re

    client_id = os.getenv("NAVER_CLIENT_ID")
    client_secret = os.getenv("NAVER_CLIENT_SECRET")

    if not client_id or not client_secret:
        return ""

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://openapi.naver.com/v1/search/webkr.json",
                headers={
                    "X-Naver-Client-Id": client_id,
                    "X-Naver-Client-Secret": client_secret,
                },
                params={
                    "query": query,
                    "display": 2,
                    "sort": "date",
                },
            )

            if response.status_code != 200:
                return ""

            data = response.json()
            items = data.get("items", [])

            if not items:
                return ""

            results = []
            for item in items[:2]:
                desc = re.sub(r'<[^>]+>', '', item.get("description", ""))
                if desc:
                    results.append(desc)

            return " ".join(results)
    except Exception:
        return ""


@router.get("/context")
async def get_context(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    today = date.today()

    # ── 주문 현황 (string literals — avoids enum mismatch with DB values) ──────
    total_orders   = db.query(Order).count()
    today_orders   = db.query(Order).filter(func.date(Order.created_at) == today).count()
    received       = db.query(Order).filter(Order.status == "RECEIVED").count()
    picking        = db.query(Order).filter(Order.status == "PICKING").count()
    packed         = db.query(Order).filter(Order.status == "PACKED").count()
    shipped        = db.query(Order).filter(Order.status == "SHIPPED").count()
    delivered_orders = db.query(Order).filter(Order.status == "DELIVERED").count()
    cancelled      = db.query(Order).filter(Order.status == "CANCELLED").count()

    # ── 배송 현황 ─────────────────────────────────────────────────────────────
    try:
        total_deliveries   = db.query(Delivery).count()
        in_transit         = db.query(Delivery).filter(Delivery.status == "IN_TRANSIT").count()
        out_for_delivery   = db.query(Delivery).filter(Delivery.status == "OUT_FOR_DELIVERY").count()
        delivered_delivery = db.query(Delivery).filter(Delivery.status == "DELIVERED").count()
        delivered_today    = db.query(Delivery).filter(
            Delivery.status == "DELIVERED",
            func.date(Delivery.updated_at) == today
        ).count()
        print(f"[AI Context] 배송: 전체={total_deliveries} 이동중={in_transit} 배달출발={out_for_delivery} 완료={delivered_delivery}")
    except Exception as e:
        import traceback; traceback.print_exc()
        print(f"[AI Context] 배송 오류: {e}")
        total_deliveries = in_transit = out_for_delivery = delivered_delivery = delivered_today = 0

    # ── 택배사별 현황 (carrier 필드) ──────────────────────────────────────────
    try:
        today_carrier = db.query(
            Delivery.carrier,
            func.count(Delivery.id).label('cnt')
        ).filter(
            func.date(Delivery.created_at) == today
        ).group_by(Delivery.carrier).all()
        courier_today_text = ""
        for carrier, cnt in today_carrier:
            courier_today_text += f"  - {carrier.value if hasattr(carrier, 'value') else carrier}: {cnt}건\n"
        courier_today_text = courier_today_text.rstrip() or "  없음"

        transit_carrier = db.query(
            Delivery.carrier,
            func.count(Delivery.id).label('cnt')
        ).filter(
            Delivery.status == "IN_TRANSIT"
        ).group_by(Delivery.carrier).all()
        transit_courier_text = ""
        for carrier, cnt in transit_carrier:
            transit_courier_text += f"  - {carrier.value if hasattr(carrier, 'value') else carrier}: {cnt}건\n"
        transit_courier_text = transit_courier_text.rstrip() or "  없음"
        print(f"[AI Context] 택배사별 이동중: {transit_courier_text[:100]}")
    except Exception as e:
        import traceback; traceback.print_exc()
        print(f"[AI Context] 택배사 오류: {e}")
        courier_today_text = transit_courier_text = "  없음"

    # ── 반품 현황 ─────────────────────────────────────────────────────────────
    _seller_name_map = {
        "CLIO Cosmetics": "클리오", "goodal": "구달",
        "b.plain": "비플레인", "BBIA Cosmetic": "삐아",
        "SKINFOOD": "스킨푸드", "d'Alba": "달바",
    }
    try:
        returns = db.query(ReturnRequest).all()
        total_returns = len(returns)
        return_detail_lines = []
        for r in returns:
            sname = _seller_name_map.get(
                r.seller.full_name if r.seller else "",
                r.seller.full_name if r.seller else "알수없음"
            )
            order_num = r.order.order_number if r.order else "알수없음"
            reason_val = r.reason.value if hasattr(r.reason, 'value') else str(r.reason)
            _reason_kr = {"DEFECTIVE": "상품불량", "CHANGE_OF_MIND": "단순변심", "WRONG_ITEM": "오배송", "DAMAGED": "파손", "OTHER": "기타"}
            reason_kr = _reason_kr.get(reason_val, reason_val)
            status_val = r.status.value if hasattr(r.status, 'value') else str(r.status)
            created = str(r.created_at)[:10] if r.created_at else ""
            return_detail_lines.append(
                f"  - {sname} | 주문:{order_num} | 사유:{reason_kr} | 상태:{status_val} | 접수일:{created}"
            )
        return_detail_text = "\n".join(return_detail_lines) or "  없음"
        print(f"[AI Context] 반품상세: {total_returns}건")
    except Exception as e:
        import traceback; traceback.print_exc()
        print(f"[AI Context] 반품 오류: {e}")
        total_returns = 0
        return_detail_text = "  데이터 없음"

    # ── 재고 현황 + 유통기한 + 재고부족 ──────────────────────────────────────
    inv_items = []
    try:
        inv_items = db.query(Product, Inventory).join(
            Inventory, Inventory.product_id == Product.id
        ).all()
        inv_text = "\n".join([
            f"  - {p.name}({p.sku}): {inv.quantity}개 [{p.location_code or '미지정'}]"
            for p, inv in inv_items
        ]) or "  데이터 없음"
        low_stock_text = "\n".join([
            f"  - {p.name}: {inv.quantity}개 (부족!)"
            for p, inv in inv_items if inv.quantity < 20
        ]) or "  없음"
        low_stock_count = sum(1 for _, inv in inv_items if inv.quantity < 20)
    except Exception as e:
        print(f"[AI Context] 재고 오류: {e}")
        inv_text = "  데이터 없음"
        low_stock_text = "  없음"
        low_stock_count = 0

    try:
        expiry_soon = db.query(Inventory).filter(
            Inventory.expiry_date != None,
            Inventory.expiry_date <= today + timedelta(days=30),
            Inventory.expiry_date >= today
        ).count()
        expiry_products = db.query(Product, Inventory).join(
            Inventory, Inventory.product_id == Product.id
        ).filter(
            Inventory.expiry_date != None,
            Inventory.expiry_date <= today + timedelta(days=30),
            Inventory.expiry_date >= today
        ).all()
        expiry_lines = []
        for p, inv in expiry_products:
            days_left = (inv.expiry_date - today).days
            expiry_lines.append(f"  - {p.name}: {days_left}일 후 만료 (재고:{inv.quantity}개)")
        expiry_text = "\n".join(expiry_lines) if expiry_lines else "  없음"
    except Exception as e:
        print(f"[AI Context] 유통기한 오류: {e}")
        expiry_soon = 0
        expiry_text = "  없음"

    # ── 전체 재고 상세 (LOT/유통기한/ABC/구역) ────────────────────────────────
    try:
        inv_detail_text = ""
        all_inv = db.query(Product, Inventory).join(
            Inventory, Inventory.product_id == Product.id
        ).all()

        for p, inv in all_inv:
            days_left_expiry = (inv.expiry_date - date.today()).days if inv.expiry_date else None
            expiry_str = f"{inv.expiry_date}(D-{days_left_expiry})" if inv.expiry_date else "-"
            lot_str = inv.lot_number if inv.lot_number else "-"
            abc = p.abc_grade if hasattr(p, 'abc_grade') and p.abc_grade else "-"
            zone = p.warehouse_zone if p.warehouse_zone else "-"

            inv_detail_text += f"{p.name}|SKU:{p.sku}|재고:{inv.quantity}|LOT:{lot_str}|유통기한:{expiry_str}|ABC:{abc}|구역:{zone}\n"

        print(f"[AI Context] 재고상세: {len(all_inv)}건, 길이:{len(inv_detail_text)}chars")
    except Exception as e:
        print(f"[AI Context] 재고상세 오류: {e}")
        inv_detail_text = "  데이터 없음"

    # ── 채널별 주문 ───────────────────────────────────────────────────────────
    try:
        channel_orders = db.query(
            Order.channel,
            func.count(Order.id).label('cnt')
        ).group_by(Order.channel).all()
        total_order_count = sum(cnt for _, cnt in channel_orders)
        channel_text = " | ".join(
            f"{(ch.value if hasattr(ch, 'value') else ch)}:{cnt}건({round(cnt/total_order_count*100,1) if total_order_count else 0}%)"
            for ch, cnt in sorted(channel_orders, key=lambda x: x[1], reverse=True)
        ) or "데이터 없음"
        print(f"[AI Context] 채널별: {channel_text[:120]}")
    except Exception as e:
        print(f"[AI Context] 채널별 주문 오류: {e}")
        channel_text = "  데이터 없음"

    # ── 브랜드별 주문 ─────────────────────────────────────────────────────────
    try:
        sellers = db.query(User).filter(User.role == UserRole.SELLER).all()
        seller_lines = []
        for seller in sellers:
            cnt = db.query(Order).filter(Order.seller_id == seller.id).count()
            today_cnt = db.query(Order).filter(
                Order.seller_id == seller.id,
                func.date(Order.created_at) == today
            ).count()
            name = seller.company_name or seller.full_name
            seller_lines.append(f"  - {name}: 전체 {cnt}건, 오늘 {today_cnt}건")
        seller_text = "\n".join(seller_lines) or "  데이터 없음"
    except Exception as e:
        print(f"[AI Context] 셀러 오류: {e}")
        seller_text = "  데이터 없음"

    # ── 냉장보관 상품 (storage_type=COLD OR warehouse_zone=D, same as InventoryPage) ──
    print("[AI Context] 냉장보관 기준 필드 확인: storage_type=COLD OR warehouse_zone=D")
    try:
        cold_products = db.query(Product, Inventory).join(
            Inventory, Inventory.product_id == Product.id
        ).filter(
            or_(Product.storage_type == StorageType.COLD, Product.warehouse_zone == "D")
        ).all()
        cold_lines = []
        for p, inv in cold_products:
            cold_lines.append(f"  - {p.name} | 재고:{inv.quantity}개 | 위치:{p.location_code}")
        cold_text = "\n".join(cold_lines) if cold_lines else "  없음"
        print(f"[AI Context] 냉장보관: {len(cold_products)}건")
    except Exception as e:
        print(f"[AI Context] 냉장보관 오류: {e}")
        cold_text = "  없음"

    # ── 슬로팅 (SlottingPage와 동일한 알고리즘) ──────────────────────────────
    try:
        from backend.routers.slotting import _turnover_data, _abc_classify, _assign_locations

        slotting_products = db.query(Product).filter(Product.is_active == True).all()
        turnover   = _turnover_data(db)
        classified = _abc_classify(slotting_products, turnover)
        recs       = _assign_locations(classified)

        slotting_lines = []
        for r in recs:
            move_flag = "⚠️이동필요" if r["needs_move"] else "적정"
            slotting_lines.append(
                f"  - {r['product_name']}: 현재={r['current_location']}({r['current_zone']}구역) | "
                f"권장={r['recommended_location']}({r['recommended_zone']}구역) | "
                f"ABC={r['abc_class']} | 30일판매={r['total_sold_30d']}개 | {move_flag}"
            )
        slotting_text = "\n".join(slotting_lines) if slotting_lines else "  데이터 없음"
        print(f"[AI Context] 슬로팅: {len(recs)}건")
    except Exception as e:
        import traceback; traceback.print_exc()
        print(f"[AI Context] 슬로팅 오류: {e}")
        slotting_text = "  데이터 없음"

    # ── 창고 구역별 재고 ──────────────────────────────────────────────────────
    try:
        zone_inventory: dict = {}
        for product, inv in inv_items:
            zone = getattr(product, 'warehouse_zone', None) or 'B'
            zone_inventory.setdefault(zone, []).append(
                f"{product.name}({product.location_code or '위치미정'}) {inv.quantity}개"
            )
        warehouse_lines = []
        for zone in ['A', 'B', 'C', 'D']:
            items_in_zone = zone_inventory.get(zone, [])
            warehouse_lines.append(f"{zone}구역: {len(items_in_zone)}개 상품")
            for item in items_in_zone[:5]:
                warehouse_lines.append(f"  - {item}")
        warehouse_text = "\n".join(warehouse_lines) or "  데이터 없음"
        print(f"[AI Context] 창고구역: {sum(len(v) for v in zone_inventory.values())}개 상품")
    except Exception as e:
        print(f"[AI Context] 창고 오류: {e}")
        warehouse_text = "  데이터 없음"

    # ── 수요예측 + 보충입고 (reorder.py와 동일한 _analyze 계산) ─────────────
    _seller_name_map_restock = {
        "CLIO Cosmetics": "클리오", "goodal": "구달",
        "b.plain": "비플레인", "BBIA Cosmetic": "삐아",
        "SKINFOOD": "스킨푸드", "d'Alba": "달바",
    }
    forecast_text = ""
    restock_text  = "  데이터 없음"
    try:
        from backend.routers.reorder import _analyze

        all_products = db.query(Product).filter(Product.is_active == True).all()
        restock_lines = []
        forecast_lines = []
        _urgency_map = {"CRITICAL": "긴급", "WARNING": "주의"}

        for product in all_products:
            data = _analyze(db, product)
            daily_demand    = data["daily_demand"]
            days_left       = data["days_of_stock"]
            current_stock   = data["current_stock"]
            recommended_qty = data["recommended_qty"]
            reorder_point   = data["reorder_point"]
            urgency_en      = data["urgency"]

            forecast_lines.append(
                f"{product.name}|일평균:{daily_demand}개|소진:{days_left}일후|재고:{current_stock}개|{urgency_en}"
            )

            urgency_kr = _urgency_map.get(urgency_en)
            if urgency_kr is None:
                continue

            seller = db.query(User).filter(User.id == product.seller_id).first()
            sname = _seller_name_map_restock.get(seller.full_name if seller else "", "")
            print(f"[AI Context] 보충입고 샘플: stock={current_stock}, daily={daily_demand}, reorder_point={reorder_point}, recommended={recommended_qty}")

            restock_lines.append(
                f"  - [{urgency_kr}] {sname} | {product.name} | "
                f"현재재고:{current_stock}개 | 일평균판매:{daily_demand}개/일 | "
                f"소진예상:{days_left}일후 | 재주문점:{reorder_point}개 | 권장발주량:{recommended_qty}개"
            )

        forecast_text = "\n".join(forecast_lines) if forecast_lines else "  데이터 없음"
        print(f"[AI Context] 수요예측(reorder._analyze): {len(all_products)}건")

        urgent_count = sum(1 for l in restock_lines if '[긴급]' in l)
        restock_text = (
            f"총 {len(restock_lines)}건 (긴급:{urgent_count}건)\n" + "\n".join(restock_lines)
            if restock_lines else "긴급/주의 상품 없음"
        )
        print(f"[AI Context] 보충입고: {len(restock_lines)}건, 긴급:{urgent_count}건")
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[AI Context] 보충입고/수요예측 오류: {e}")

    # ── 입고 예정 ─────────────────────────────────────────────────────────────
    try:
        inbounds = db.query(Inbound).all()
        morning_lines = []
        afternoon_lines = []
        for i in inbounds:
            product_name = i.product.name if i.product else "상품"
            seller_name = (
                i.product.seller.company_name or i.product.seller.full_name
                if i.product and i.product.seller else "브랜드"
            )
            time_slot = getattr(i, 'time_slot', None)
            entry = f"  - {seller_name} | {product_name} | {i.quantity}개 | {i.inbound_date}"
            if time_slot:
                entry += f" | {time_slot}"
                if str(time_slot).startswith(('09', '10', '11')):
                    morning_lines.append(entry)
                else:
                    afternoon_lines.append(entry)
            else:
                morning_lines.append(entry)
        inbound_text = "오전 (09:00-12:00):\n"
        inbound_text += "\n".join(morning_lines) if morning_lines else "  없음"
        inbound_text += "\n오후 (14:00-17:00):\n"
        inbound_text += "\n".join(afternoon_lines) if afternoon_lines else "  없음"
        print(f"[AI Context] 입고예정: {len(inbounds)}건")
    except Exception as e:
        print(f"[AI Context] 입고 오류: {e}")
        inbound_text = "  데이터 없음"

    # ── 내일 입고 스케줄 ──────────────────────────────────────────────────────
    try:
        from backend.models.inbound_schedule import InboundSchedule
        tomorrow = date.today() + timedelta(days=1)
        print(f"[AI Context] 내일 날짜: {tomorrow}")
        cols = [c.name for c in InboundSchedule.__table__.columns]
        print(f"[AI Context] InboundSchedule 컬럼: {cols}")
        all_schedules = db.query(InboundSchedule).all()
        for s in all_schedules[:5]:
            print(f"[AI Context] 스케줄 날짜: {s.scheduled_date}, 시간: {s.time_slot}, seller_id: {s.seller_id}")
        scheduled = db.query(InboundSchedule).filter(
            InboundSchedule.scheduled_date == tomorrow
        ).order_by(InboundSchedule.time_slot).all()
        sched_morning = []
        sched_afternoon = []
        for s in scheduled:
            seller_name = (
                s.seller.company_name or s.seller.full_name if s.seller else "브랜드"
            )
            time_slot = s.time_slot or "미정"
            product_info = ""
            if s.inbound and s.inbound.product:
                p = s.inbound.product
                product_info = f" | {p.name} {s.inbound.quantity}개"
            entry = f"  - {time_slot} | 도크{s.dock_number} | {seller_name}{product_info}"
            if time_slot and time_slot != "미정":
                try:
                    hour = int(time_slot[:2])
                    if 9 <= hour <= 11:
                        sched_morning.append(entry)
                    elif 14 <= hour <= 17:
                        sched_afternoon.append(entry)
                    # 12, 13시는 점심시간이라 제외
                except ValueError:
                    pass
        morning_text   = "\n".join(sched_morning)   if sched_morning   else "  없음"
        afternoon_text = "\n".join(sched_afternoon) if sched_afternoon else "  없음"
        morning_count   = morning_text.count('- ')
        afternoon_count = afternoon_text.count('- ')
        print(f"[AI Context] 입고스케줄: 오전{morning_count}건 오후{afternoon_count}건")
        print(f"[AI Context] 입고스케줄 오전내용: {morning_text[:100]}")
        print(f"[AI Context] 입고스케줄 오후내용: {afternoon_text[:100]}")
    except Exception as e:
        print(f"[AI Context] 입고스케줄 오류: {e}")
        morning_text = afternoon_text = "  데이터 없음"

    # ── 프로모션 ──────────────────────────────────────────────────────────────
    try:
        promos = db.query(Promotion).filter(Promotion.end_date >= today).all()
        promo_text = "\n".join([
            f"  - {p.name}: {p.start_date} ~ {p.end_date}"
            for p in promos
        ]) or "  없음"
        print(f"[AI Context] 프로모션: {len(promos)}건")
    except Exception as e:
        print(f"[AI Context] 프로모션 오류: {e}")
        promo_text = "  데이터 없음"

    # ── 이슈 현황 ─────────────────────────────────────────────────────────────
    try:
        issues = db.query(OrderIssue).all()
        issue_text = "\n".join([
            f"  - [{i.priority}] {i.title} ({i.status})"
            for i in issues
        ]) or "  없음"
        open_count = sum(1 for i in issues if i.status == "OPEN")
        print(f"[AI Context] 이슈: {len(issues)}건")
    except Exception as e:
        print(f"[AI Context] 이슈 오류: {e}")
        issue_text = "  데이터 없음"
        open_count = 0

    # ── 정산 현황 ─────────────────────────────────────────────────────────────
    try:
        from backend.models.settlement import Settlement, SettlementStatus
        settlements = db.query(Settlement).all()
        unsettled = [s for s in settlements if s.status == SettlementStatus.DRAFT]
        confirmed  = [s for s in settlements if s.status == SettlementStatus.CONFIRMED]
        settlement_lines = ["미확정 정산:"]
        for s in unsettled:
            seller_name = (
                s.seller.company_name or s.seller.full_name if s.seller else "알 수 없음"
            )
            settlement_lines.append(f"  - {seller_name}: {s.year_month} 합계 {s.total_fee:,.0f}원")
        settlement_lines.append(f"\n확정 완료: {len(confirmed)}건")
        settlement_text = "\n".join(settlement_lines)
    except Exception as e:
        print(f"[AI Context] 정산 오류: {e}")
        settlement_text = "  데이터 없음"

    # ── 채팅/문의 현황 ────────────────────────────────────────────────────────
    try:
        from backend.models.chat_room import ChatRoom
        from backend.models.chat_message import ChatMessage
        chat_rooms = db.query(ChatRoom).all()
        chat_lines = []
        unread_sellers = []
        for room in chat_rooms:
            seller_name = (
                room.seller.company_name or room.seller.full_name if room.seller else "알 수 없음"
            )
            last_msg_obj = db.query(ChatMessage).filter(
                ChatMessage.room_id == room.id
            ).order_by(ChatMessage.created_at.desc()).first()
            if last_msg_obj:
                sender_is_seller = last_msg_obj.sender_id == room.seller_id
                is_unread = sender_is_seller
                status = "★미읽음(답장필요)" if is_unread else "읽음(답장완료)"
                content = last_msg_obj.message[:30]
                if is_unread:
                    unread_sellers.append(seller_name)
            else:
                status = "메시지없음"
                content = ""
            chat_lines.append(f"  - {seller_name}: {status} | '{content}'")
        chat_text   = "\n".join(chat_lines) or "  없음"
        unread_text = ", ".join(unread_sellers) if unread_sellers else "없음(모두답장완료)"
        print(f"[AI Context] 채팅 미읽음: {unread_text}")
    except Exception as e:
        print(f"[AI Context] 채팅 오류: {e}")
        chat_text   = "  데이터 없음"
        unread_text = "확인불가"

    # ── Debug summary ─────────────────────────────────────────────────────────
    print(f"[AI Context] 주문:{total_orders} 접수:{received} 피킹:{picking} 출고:{shipped} 완료:{delivered_orders}")
    print(f"[AI Context] 배송전체:{total_deliveries} 이동중:{in_transit} 배달출발:{out_for_delivery} 완료:{delivered_delivery}")
    print(f"[AI Context] 반품:{total_returns} 유통기한임박:{expiry_soon} 재고부족:{low_stock_count}")

    context_text = f"""오늘: {today}
내일: {today + timedelta(days=1)}

=== 주문 현황 ===
전체주문: {total_orders}건
오늘신규: {today_orders}건
주문접수대기: {received}건
출고준비중: {picking}건
패킹완료: {packed}건
출고완료: {shipped}건
배송완료(주문기준): {delivered_orders}건
취소: {cancelled}건

=== 미처리 주문 현황 ===
미처리주문합계(처리필요): {received + picking + packed}건
- 주문접수대기(RECEIVED): {received}건
- 출고준비중(PICKING): {picking}건
- 패킹완료(PACKED): {packed}건

=== 채널별 주문 현황 ===
(채널 = 판매 플랫폼: SMARTSTORE/CAFE24/OLIVEYOUNG/ZIGZAG/MANUAL)
(셀러 = 브랜드: 달바/클리오/구달/비플레인/삐아/스킨푸드)
{channel_text}

=== 브랜드별 주문 ===
{seller_text}

=== 배송 현황 ===
전체배송: {total_deliveries}건
이동중(IN_TRANSIT): {in_transit}건
배달출발(OUT_FOR_DELIVERY): {out_for_delivery}건
배송완료: {delivered_delivery}건
오늘배송완료: {delivered_today}건

=== 오늘 출고 택배사별 현황 ===
{courier_today_text}

=== 이동중 택배사별 현황 ===
{transit_courier_text}

=== 반품 현황 ===
전체반품: {total_returns}건
{return_detail_text}

=== 재고 알림 ===
유통기한임박(30일이내): {expiry_soon}건
{expiry_text}
재고부족(20개미만): {low_stock_count}건

=== 재고 현황 (전체) ===
{inv_text}

=== 전체 재고 상세 (LOT/유통기한/ABC/구역) ===
{inv_detail_text}

=== 재고 부족 (20개 미만) ===
{low_stock_text}

=== 창고 구역별 재고 ===
{warehouse_text}

=== 냉장보관 상품 (D구역) ===
{cold_text}

=== 상품별 창고 위치 (슬로팅) ===
{slotting_text}

=== 수요예측 Prophet (일평균/소진/추세) ===
{forecast_text}

=== 보충 입고 요청 (긴급/권고) ===
{restock_text}

=== 내일 입고 스케줄 (오전/오후 구분) ===
오전(09:00-12:00): {morning_text}
오후(14:00-17:00): {afternoon_text}

=== 전체 입고 예정 ===
{inbound_text}

=== 프로모션 일정 ===
{promo_text}

=== 이슈 현황 (미해결: {open_count}건) ===
{issue_text}

=== 정산 현황 ===
{settlement_text}

=== 채팅 현황 ===
미읽음(답장필요): {unread_text}
{chat_text}
"""

    print(f"[AI Context] 전체 context 길이: {len(context_text)} chars")
    return {"data": context_text}


def filter_context_for_question(full_context: str, message: str) -> str:
    msg = message.lower()
    lines = full_context.split('\n')

    sections = {}
    current_key = "기본"
    current_lines = []

    for line in lines:
        if line.startswith('==='):
            if current_lines:
                sections[current_key] = '\n'.join(current_lines)
            current_key = line.strip('= ')
            current_lines = [line]
        else:
            current_lines.append(line)
    if current_lines:
        sections[current_key] = '\n'.join(current_lines)

    # Always include basic order/date info
    base_keys = ["주문 현황", "미처리 주문", "오늘"]
    base = '\n'.join(v for k, v in sections.items() if any(b in k for b in base_keys))

    # Keyword to section mapping
    keyword_map = {
        ("유통기한", "만료", "lot", "로트", "lot번호", "abc", "구역", "보관"): ["재고 상세", "LOT", "유통"],
        ("보충", "긴급", "소진", "재주문"): ["보충 입고", "재고부족"],
        ("일평균", "소진", "예상", "수요", "판매량", "forecast"): ["수요예측", "소진", "보충 입고"],
        ("채널", "스마트스토어", "올리브영", "지그재그", "카페24"): ["채널별"],
        ("미처리", "처리필요", "접수대기"): ["미처리 주문"],
        ("셀러", "브랜드", "주문 많"): ["브랜드별"],
        ("채팅", "미읽음", "답장"): ["채팅"],
        ("입고", "스케줄", "오전", "오후", "내일", "도크"): ["입고", "스케줄", "인바운드"],
        ("프로모션", "세일", "행사"): ["프로모션"],
        ("이슈", "문제"): ["이슈"],
        ("정산", "미확정"): ["정산"],
        ("배송", "택배", "이동중", "택배사", "cj", "한진", "롯데", "로젠"): ["배송", "택배사", "이동중"],
        ("반품", "반송", "교환", "환불", "restocked", "disposed"): ["반품 현황"],
        ("냉장",): ["냉장"],
        ("슬로팅", "위치", "구역"): ["슬로팅", "창고"],
    }

    extra = ""
    for keywords, section_keys in keyword_map.items():
        if any(k in msg for k in keywords):
            for sk in section_keys:
                for k, v in sections.items():
                    if sk in k:
                        extra += v + "\n"

    result = base + "\n" + extra if extra else full_context
    print(f"[AI Chat] 원본 context: {len(full_context)}chars → 필터링: {len(result)}chars")
    return result


@router.post("/chat")
async def chat(
    request: dict,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_message = request.get("message", "")
    context_str = request.get("context", "{}")
    history = request.get("history", "")

    # Get fresh context from DB
    context_response = await get_context(current_user=current_user, db=db)
    full_context = context_response.get("data", context_str)

    # Filter to only relevant sections
    filtered_context = filter_context_for_question(full_context, user_message)

    search_result = ""
    search_keywords = ["날씨", "뉴스", "최근", "지금 기온", "비", "눈"]
    if any(k in user_message for k in search_keywords):
        search_result = await search_naver(user_message)

    system_prompt = f"""당신은 FullFit 화장품 풀필먼트 센터 AI 어시스턴트입니다.

[데이터 구조 - 반드시 숙지]
채널(판매플랫폼): SMARTSTORE=스마트스토어, CAFE24=카페24, OLIVEYOUNG=올리브영, ZIGZAG=지그재그, MANUAL=수동
셀러(브랜드): 달바, 클리오, 구달, 비플레인, 삐아, 스킨푸드
택배사(carrier): CJ, HANJIN, LOTTE, ROSEN, ETC
미처리주문 = 주문접수대기(RECEIVED)+출고준비중(PICKING)+패킹완료(PACKED) 합산
LOT번호: 배치 식별자 | 유통기한만료일: 실제 만료 날짜 | 재고소진예상: 현재재고 소진까지 남은 일수(유통기한과 다름!)

[현재 운영 데이터]
{filtered_context}

{f"[웹검색 결과]{chr(10)}{search_result}" if search_result else ""}

{f"[이전 대화]{chr(10)}{history}" if history else ""}

[답변 규칙]
- 채널 질문 → 채널별 주문 현황 섹션 참고 (SMARTSTORE/CAFE24/OLIVEYOUNG/ZIGZAG/MANUAL)
- 미처리주문 질문 → 미처리주문합계 숫자 사용
- 택배사 질문 → 택배사별 현황 섹션 참고
- 한국어로만 답변, 2-3문장 간결하게, 반복 금지"""

    import re

    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            response = await client.post(
                "http://localhost:11434/api/chat",
                json={
                    "model": "qwen3:8b",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": f"질문: {user_message}\n\n답변:"},
                    ],
                    "stream": False,
                    "think": False,
                    "options": {
                        "temperature": 0.1,
                        "repeat_penalty": 1.4,
                        "num_predict": 300,
                        "num_ctx": 8192,
                    },
                },
            )
            result = response.json()
            print(f"[AI Debug] Result: {str(result)[:300]}")

            result_text = result.get("message", {}).get("content", "")
            result_text = re.sub(r'<think>.*?</think>', '', result_text, flags=re.DOTALL).strip()

            if not result_text:
                print(f"[AI Debug] Empty response. Full result: {result}")
                return {"response": "응답을 생성할 수 없습니다."}

            return {"response": result_text}
    except httpx.ConnectError:
        return {"response": "Ollama 서버에 연결할 수 없습니다. `ollama run qwen3:8b` 명령어로 서버를 시작해주세요."}
    except Exception as e:
        return {"response": f"오류가 발생했습니다: {str(e)}"}
