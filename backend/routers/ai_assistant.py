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
from backend.models.order_item import OrderItem
from backend.models.inbound import Inbound
from backend.models.delivery import Delivery, DeliveryStatus
from backend.models.return_request import ReturnRequest, ReturnStatus
from backend.models.order_issue import OrderIssue
from backend.models.promotion import Promotion
from backend.models.settlement import Settlement, SettlementStatus
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
    tomorrow = today + timedelta(days=1)

    # 1. 주문 현황
    received = db.query(Order).filter(Order.status == OrderStatus.RECEIVED).count()
    picking = db.query(Order).filter(Order.status == OrderStatus.PICKING).count()
    packed = db.query(Order).filter(Order.status == OrderStatus.PACKED).count()
    shipped = db.query(Order).filter(Order.status == OrderStatus.SHIPPED).count()
    delivered = db.query(Order).filter(Order.status == OrderStatus.DELIVERED).count()
    cancelled = db.query(Order).filter(Order.status == OrderStatus.CANCELLED).count()
    total_orders = db.query(Order).count()

    # 2. 오늘 주문
    today_orders = db.query(Order).filter(
        func.date(Order.created_at) == today
    ).count()

    # 3. 셀러 목록
    sellers = db.query(User).filter(User.role == UserRole.SELLER).all()
    seller_list = []
    for seller in sellers:
        seller_order_count = db.query(Order).filter(
            Order.seller_id == seller.id
        ).count()
        seller_list.append({
            "브랜드명": seller.company_name or seller.full_name,
            "이메일": seller.email,
            "총주문수": seller_order_count,
        })

    # 4. 재고 현황 전체
    inventories = db.query(Product, Inventory).join(
        Inventory, Inventory.product_id == Product.id
    ).all()

    inventory_list = []
    low_stock_list = []
    for product, inv in inventories:
        inventory_list.append({
            "상품명": product.name,
            "SKU": product.sku,
            "브랜드": product.seller.company_name or product.seller.full_name if product.seller else "",
            "재고": inv.quantity,
            "위치": product.location_code or "미지정",
        })
        if inv.quantity < 20:
            low_stock_list.append({
                "상품명": product.name,
                "재고": inv.quantity,
            })

    # 5. 배송 현황
    in_transit = db.query(Delivery).filter(
        Delivery.status == DeliveryStatus.IN_TRANSIT
    ).count()
    out_for_delivery = db.query(Delivery).filter(
        Delivery.status == DeliveryStatus.OUT_FOR_DELIVERY
    ).count()
    delivered_today = db.query(Delivery).filter(
        Delivery.status == DeliveryStatus.DELIVERED,
        func.date(Delivery.updated_at) == today
    ).count()

    # 6. 입고 예정
    try:
        all_inbound = db.query(Inbound).limit(10).all()

        inbound_list = []
        for req in all_inbound:
            product_name = req.product.name if req.product else "상품"
            seller_name = (
                req.product.seller.company_name or req.product.seller.full_name
                if req.product and req.product.seller
                else "브랜드"
            )
            inbound_list.append({
                "브랜드": seller_name,
                "상품명": product_name,
                "수량": req.quantity,
                "예정일": str(req.inbound_date),
            })
        print(f"[AI Context] 입고예정: {len(inbound_list)}건")
    except Exception as e:
        print(f"[AI Context] 입고 오류: {e}")
        inbound_list = []

    # 7. 프로모션 캘린더
    try:
        promotions = db.query(Promotion).filter(
            Promotion.end_date >= today
        ).all()
        promotion_list = []
        for p in promotions:
            promotion_list.append({
                "이름": p.name,
                "채널": str(p.channel.value) if p.channel else "",
                "시작일": str(p.start_date),
                "종료일": str(p.end_date),
                "주문배수": str(p.expected_order_multiplier),
            })
        print(f"[AI Context] 프로모션: {len(promotion_list)}건")
    except Exception as e:
        print(f"[AI Context] 프로모션 오류: {e}")
        promotion_list = []

    # 8. 이슈 현황
    try:
        all_issues = db.query(OrderIssue).all()
        issue_list = []
        for issue in all_issues:
            issue_list.append({
                "제목": issue.title,
                "유형": issue.issue_type,
                "우선순위": issue.priority,
                "상태": issue.status,
                "셀러": (
                    issue.seller.company_name or issue.seller.full_name
                    if issue.seller else ""
                ),
                "설명": issue.description or "",
            })
        open_issues_count = len([i for i in issue_list if i["상태"] == "OPEN"])
        print(f"[AI Context] 이슈: {len(issue_list)}건")
    except Exception as e:
        print(f"[AI Context] 이슈 오류: {e}")
        issue_list = []
        open_issues_count = 0

    # 9. 반품 현황
    try:
        return_requested = db.query(ReturnRequest).filter(
            ReturnRequest.status == ReturnStatus.REQUESTED
        ).count()
        return_in_review = db.query(ReturnRequest).filter(
            ReturnRequest.status == ReturnStatus.IN_REVIEW
        ).count()
    except Exception as e:
        print(f"[AI Context] 반품 오류: {e}")
        return_requested = 0
        return_in_review = 0

    # 10. 정산 현황
    try:
        unsettled = db.query(Settlement).filter(
            Settlement.status == SettlementStatus.DRAFT
        ).count()
        settled = db.query(Settlement).filter(
            Settlement.status == SettlementStatus.CONFIRMED
        ).count()
    except Exception as e:
        print(f"[AI Context] 정산 오류: {e}")
        unsettled = 0
        settled = 0

    return {
        "오늘날짜": str(today),
        "내일날짜": str(tomorrow),
        "주문현황": {
            "전체주문": total_orders,
            "오늘신규": today_orders,
            "주문접수대기": received,
            "출고준비중": picking,
            "패킹완료": packed,
            "출고완료": shipped,
            "배송완료": delivered,
            "취소": cancelled,
        },
        "배송현황": {
            "배송중": in_transit,
            "배달출발": out_for_delivery,
            "오늘배송완료": delivered_today,
        },
        "재고현황": inventory_list,
        "재고부족상품": low_stock_list,
        "셀러목록": seller_list,
        "입고예정": inbound_list,
        "프로모션일정": promotion_list,
        "이슈목록": issue_list,
        "미해결이슈수": open_issues_count,
        "반품현황": {
            "접수대기": return_requested,
            "검수중": return_in_review,
        },
        "정산현황": {
            "미확정": unsettled,
            "확정완료": settled,
        },
    }


@router.post("/chat")
async def chat(
    request: dict,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_message = request.get("message", "")
    context = request.get("context", {})

    # Keywords that need web search
    search_keywords = ["날씨", "뉴스", "최근", "지금", "현재 기온", "비", "눈", "맑음", "흐림"]
    needs_search = any(kw in user_message for kw in search_keywords)

    search_result = ""
    if needs_search:
        search_result = await search_naver(user_message)

    system_prompt = f"""당신은 FullFit 운영 어시스턴트입니다. 한국어로만 답변하세요.

[운영 데이터]
{context}

{f"[검색 결과]{chr(10)}{search_result}" if search_result else ""}

[절대 규칙]
- 2-3문장으로만 답변
- "운영 데이터에서", "웹 검색 결과에 따르면", "해당 정보가 없습니다" 같은 메타 설명 절대 금지
- 핵심 정보만 자연스럽게 말하기
- 날씨 질문이면 그냥 날씨만 말하기
- 운영 질문이면 데이터 기반으로 바로 답하기
- 영어, 한자, 일본어 절대 금지
- 같은 말 반복 금지

예시:
질문: 서울 날씨 어때?
좋은 답변: 오늘 서울은 흐리고 약한 비가 내리고 있습니다. 기온은 약 12도입니다.
나쁜 답변: 웹 검색 결과에 따르면... 운영 데이터에서 찾을 수 없어서...

질문: 재고 부족 상품 있어?
좋은 답변: 현재 구달 흑당근 앰플(8개), 비플레인 장벽크림(12개), 스킨푸드 아이크림(5개)이 재고 부족입니다.
나쁜 답변: 재고부족상품 목록을 확인해보면..."""

    full_prompt = f"{system_prompt}\n\n질문: {user_message}\n\n답변:"

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "http://localhost:11434/api/generate",
                json={
                    "model": "llama3.1:8b",
                    "prompt": full_prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.2,
                        "top_p": 0.9,
                        "repeat_penalty": 1.5,
                        "num_predict": 150,
                        "stop": ["\n\n", "질문:", "["],
                    },
                },
            )
            result = response.json()
            return {"response": result.get("response", "응답을 생성할 수 없습니다.")}
    except httpx.ConnectError:
        return {"response": "Ollama 서버에 연결할 수 없습니다. `ollama run llama3.1:8b` 명령어로 서버를 시작해주세요."}
    except Exception as e:
        return {"response": f"오류가 발생했습니다: {str(e)}"}
