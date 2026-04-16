from datetime import date, timedelta
import os
import httpx
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models.user import User, UserRole
from backend.models.product import Product
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

    # 주문 현황
    received = db.query(Order).filter(Order.status == OrderStatus.RECEIVED).count()
    picking = db.query(Order).filter(Order.status == OrderStatus.PICKING).count()
    packed = db.query(Order).filter(Order.status == OrderStatus.PACKED).count()
    shipped = db.query(Order).filter(Order.status == OrderStatus.SHIPPED).count()
    delivered = db.query(Order).filter(Order.status == OrderStatus.DELIVERED).count()
    cancelled = db.query(Order).filter(Order.status == OrderStatus.CANCELLED).count()
    total_orders = db.query(Order).count()
    today_orders = db.query(Order).filter(func.date(Order.created_at) == today).count()

    # 채널별 주문
    try:
        channel_orders = db.query(
            Order.channel,
            func.count(Order.id).label('count')
        ).group_by(Order.channel).all()
        channel_text = "\n".join([
            f"  - {ch.value if hasattr(ch, 'value') else ch}: {cnt}건"
            for ch, cnt in channel_orders
        ]) or "  데이터 없음"
    except Exception as e:
        print(f"[AI Context] 채널별 주문 오류: {e}")
        channel_text = "  데이터 없음"

    # 브랜드별 주문
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

    # 재고 현황
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
    except Exception as e:
        print(f"[AI Context] 재고 오류: {e}")
        inv_text = "  데이터 없음"
        low_stock_text = "  없음"

    # 배송 현황
    try:
        in_transit = db.query(Delivery).filter(Delivery.status == DeliveryStatus.IN_TRANSIT).count()
        out_for_delivery = db.query(Delivery).filter(Delivery.status == DeliveryStatus.OUT_FOR_DELIVERY).count()
        delivered_today = db.query(Delivery).filter(
            Delivery.status == DeliveryStatus.DELIVERED,
            func.date(Delivery.updated_at) == today
        ).count()
    except Exception as e:
        print(f"[AI Context] 배송 오류: {e}")
        in_transit = out_for_delivery = delivered_today = 0

    # 입고 예정 (전체, 오전/오후 구분)
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

    # 프로모션
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

    # 이슈 현황
    try:
        issues = db.query(OrderIssue).all()
        issue_text = "\n".join([
            f"  - [{i.priority}] {i.title} ({i.status})"
            for i in issues
        ]) or "  없음"
        open_count = len([i for i in issues if i.status == "OPEN"])
        print(f"[AI Context] 이슈: {len(issues)}건")
    except Exception as e:
        print(f"[AI Context] 이슈 오류: {e}")
        issue_text = "  데이터 없음"
        open_count = 0

    # 반품 현황
    try:
        return_requested = db.query(ReturnRequest).filter(ReturnRequest.status == ReturnStatus.REQUESTED).count()
        return_in_review = db.query(ReturnRequest).filter(ReturnRequest.status == ReturnStatus.IN_REVIEW).count()
    except Exception as e:
        print(f"[AI Context] 반품 오류: {e}")
        return_requested = return_in_review = 0

    # 정산 현황
    try:
        from backend.models.settlement import Settlement, SettlementStatus
        settlements = db.query(Settlement).all()
        unsettled = [s for s in settlements if s.status == SettlementStatus.DRAFT]
        confirmed = [s for s in settlements if s.status == SettlementStatus.CONFIRMED]
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

    # 채팅/문의 현황 (미읽음 포함)
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
                # Unread = last message sent by seller (admin hasn't replied yet)
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

        chat_text = "\n".join(chat_lines) or "  없음"
        unread_text = ", ".join(unread_sellers) if unread_sellers else "없음(모두답장완료)"
        print(f"[AI Context] 채팅 미읽음: {unread_text}")
    except Exception as e:
        print(f"[AI Context] 채팅 오류: {e}")
        chat_text = "  데이터 없음"
        unread_text = "확인불가"

    # 보충입고 요청
    try:
        from backend.models.reorder import ReorderRecommendation
        sample = db.query(ReorderRecommendation).first()
        if sample:
            cols = [c.name for c in ReorderRecommendation.__table__.columns]
            print(f"[AI Context] Reorder 컬럼: {cols}")
            print(f"[AI Context] 샘플: stock={sample.current_stock}, urgency={getattr(sample, 'urgency', 'N/A')}, days={getattr(sample, 'days_of_stock', 'N/A')}")
        restock_items = db.query(ReorderRecommendation).filter(
            ReorderRecommendation.status == "PENDING"
        ).all()
        seller_name_map = {
            "CLIO Cosmetics": "클리오",
            "goodal": "구달",
            "b.plain": "비플레인",
            "BBIA Cosmetic": "삐아",
            "SKINFOOD": "스킨푸드",
            "d'Alba": "달바",
        }
        restock_lines = []
        for r in restock_items:
            product_name = r.product.name if r.product else "상품"
            display_name = (
                seller_name_map.get(r.seller.full_name, r.seller.full_name)
                if r.seller else "브랜드"
            )
            urgency = "긴급" if r.current_stock < 20 else "권고"
            restock_lines.append(
                f"  - {display_name} | {product_name} | 현재재고:{r.current_stock}개 | 권장보충:{r.recommended_qty}개 | {urgency}"
            )
        urgent_lines = [l for l in restock_lines if '긴급' in l]
        normal_lines = [l for l in restock_lines if '권고' in l]

        urgent_names = []
        for r in restock_items:
            product = db.query(Product).filter(Product.id == r.product_id).first()
            if product and r.current_stock < 20:
                seller = db.query(User).filter(User.id == r.seller_id).first()
                sname = seller_name_map.get(seller.full_name if seller else "", "")
                urgent_names.append(f"{sname} {product.name}(재고:{r.current_stock}개)")

        restock_text = f"""긴급보충필요={len(urgent_names)}건, 목록={"|".join(urgent_names)}
권고={len(normal_lines)}건
""" + "\n".join(restock_lines)
        print(f"[AI Context] 보충입고: {len(restock_items)}건")
        print(f"[AI Context] 보충입고 내용:\n{restock_text}")
    except Exception as e:
        print(f"[AI Context] 보충입고 오류: {e}")
        restock_text = "  데이터 없음"

    # 내일 입고 스케줄 (오전/오후 구분)
    try:
        from backend.models.inbound_schedule import InboundSchedule
        tomorrow = today + timedelta(days=1)
        scheduled = db.query(InboundSchedule).filter(
            InboundSchedule.scheduled_date == tomorrow
        ).order_by(InboundSchedule.time_slot).all()
        morning_lines = []
        afternoon_lines = []
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
            if time_slot[:2] in ('09', '10', '11'):
                morning_lines.append(entry)
            else:
                afternoon_lines.append(entry)
        morning_text = "\n".join(morning_lines) if morning_lines else "  없음"
        afternoon_text = "\n".join(afternoon_lines) if afternoon_lines else "  없음"
        print(f"[AI Context] 입고스케줄: 오전{len(morning_lines)}건 오후{len(afternoon_lines)}건")
    except Exception as e:
        print(f"[AI Context] 입고스케줄 오류: {e}")
        morning_text = "  데이터 없음"
        afternoon_text = "  데이터 없음"

    # 창고 구역별 재고
    try:
        zone_inventory: dict = {}
        for product, inv in inv_items:
            zone = getattr(product, 'warehouse_zone', None) or 'B'
            zone_inventory.setdefault(zone, []).append(
                f"{product.name}({product.location_code or '위치미정'}) {inv.quantity}개"
            )
        warehouse_lines = []
        for zone in ['A', 'B', 'C', 'D']:
            items = zone_inventory.get(zone, [])
            warehouse_lines.append(f"{zone}구역: {len(items)}개 상품")
            for item in items[:5]:
                warehouse_lines.append(f"  - {item}")
        warehouse_text = "\n".join(warehouse_lines) or "  데이터 없음"
        print(f"[AI Context] 창고구역: {sum(len(v) for v in zone_inventory.values())}개 상품")
    except Exception as e:
        print(f"[AI Context] 창고 오류: {e}")
        warehouse_text = "  데이터 없음"

    context_text = f"""오늘: {today}
내일: {today + timedelta(days=1)}

=== 주문 현황 ===
  전체: {total_orders}건 | 오늘 신규: {today_orders}건
  주문접수대기: {received}건 | 출고준비중: {picking}건
  패킹완료: {packed}건 | 출고완료: {shipped}건
  배송완료: {delivered}건 | 취소: {cancelled}건

=== 채널별 주문 ===
{channel_text}

=== 브랜드별 주문 ===
{seller_text}

=== 재고 현황 (전체) ===
{inv_text}

=== 재고 부족 (20개 미만) ===
{low_stock_text}

=== 창고 구역별 재고 ===
{warehouse_text}

=== 보충 입고 요청 (긴급/권고) ===
{restock_text}

=== 내일 입고 스케줄 ===
오전 (09:00~12:00):
{morning_text}
오후 (14:00~17:00):
{afternoon_text}

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

=== 배송 현황 ===
  배송중: {in_transit}건 | 배달출발: {out_for_delivery}건
  오늘 배송완료: {delivered_today}건
"""

    print(f"[AI Context] 전체 context 길이: {len(context_text)} chars")
    return {"data": context_text}


@router.post("/chat")
async def chat(
    request: dict,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_message = request.get("message", "")
    context = request.get("context", "")
    history = request.get("history", "")

    # Keywords that need web search
    search_keywords = ["날씨", "뉴스", "최근", "지금", "현재 기온", "비", "눈", "맑음", "흐림"]
    needs_search = any(kw in user_message for kw in search_keywords)

    search_result = ""
    if needs_search:
        search_result = await search_naver(user_message)

    history_context = f"\n[이전 대화]\n{history}\n" if history else ""

    system_prompt = f"""당신은 FullFit 화장품 풀필먼트 센터 AI 어시스턴트입니다.

[중요 데이터 구조 설명]
- 셀러(브랜드): 달바, 클리오, 구달, 비플레인, 삐아, 스킨푸드 (총 6개)
- 채널: SMARTSTORE(스마트스토어), CAFE24(카페24), OLIVEYOUNG(올리브영), ZIGZAG(지그재그), MANUAL(수동)
- 셀러와 채널은 완전히 다른 개념입니다

[운영 데이터]
{context}

{f"[웹검색 결과]{chr(10)}{search_result}" if search_result else ""}

[답변 규칙]
- 한국어로만 답변
- 셀러 질문 → 브랜드별 데이터(달바/클리오 등) 사용
- 채널 질문 → SMARTSTORE/CAFE24 등 채널 데이터 사용
- 긴급 질문 → 긴급 표시된 항목만 답변
- 보충입고 질문 → 보충 입고 요청 섹션 참고
- 채팅 미읽음 질문 → 채팅 현황에서 ★미읽음 표시된 것 확인
- 입고 오전/오후 질문 → 내일 입고 스케줄 섹션 참고
- 2-3문장으로 간결하게
- 반복 금지
- 브랜드명: d'Alba→달바, CLIO→클리오, goodal→구달, b.plain→비플레인, BBIA→삐아, SKINFOOD→스킨푸드
- 상품명은 반드시 데이터에 있는 정확한 이름 그대로 말할 것. 절대 줄이거나 바꾸지 말 것.
- 예: "구달 흑당근 레티놀 탄력 앰플 30ml" → 그대로, "구달 청귤비타C세럼"으로 바꾸면 안됨"""

    import re

    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            response = await client.post(
                "http://localhost:11434/api/chat",
                json={
                    "model": "qwen3:8b",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": f"{history_context}질문: {user_message}\n\n답변:"},
                    ],
                    "stream": False,
                    "think": False,
                    "options": {
                        "temperature": 0.1,
                        "repeat_penalty": 1.4,
                        "num_predict": 300,
                    },
                },
            )
            result = response.json()
            print(f"[AI Debug] Result: {str(result)[:300]}")

            result_text = result.get("message", {}).get("content", "")
            result_text = re.sub(r'<think>.*?</think>', '', result_text, flags=re.DOTALL).strip()

            if not result_text:
                print(f"[AI Debug] Empty response. Full result: {result}")
                return {"response": "데이터를 분석 중입니다. 잠시 후 다시 시도해주세요."}

            return {"response": result_text}
    except httpx.ConnectError:
        return {"response": "Ollama 서버에 연결할 수 없습니다. `ollama run qwen3:8b` 명령어로 서버를 시작해주세요."}
    except Exception as e:
        return {"response": f"오류가 발생했습니다: {str(e)}"}
