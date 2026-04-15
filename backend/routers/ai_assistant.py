from datetime import date, timedelta
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
):
    user_message = request.get("message", "")
    context = request.get("context", {})

    system_prompt = f"""[시스템 지시사항 - 절대 규칙]
1. 반드시 한국어로만 답변하세요. 영어, 일본어, 한자 사용 절대 금지.
2. 아래 데이터에 있는 정보는 정확하게 답변하세요.
3. 3-5문장으로 간결하게 답변하세요.
4. 데이터에 없는 내용은 "해당 데이터가 없습니다"라고 답변하세요.

[FullFit 화장품 풀필먼트 센터 운영 데이터]
{context}

[데이터 활용 규칙]
- 주소오류 질문 → 이슈목록에서 유형이 ADDRESS_ERROR인 항목 확인
- 재고부족 질문 → 재고부족상품 또는 이슈목록에서 STOCK_SHORTAGE 확인
- 프로모션 질문 → 프로모션일정 확인
- 입고 질문 → 입고예정 확인
- 셀러 질문 → 셀러목록 확인
- 주문 질문 → 주문현황 확인
- 이슈 질문 → 이슈목록 전체 확인

답변 시작 전 반드시 관련 데이터를 확인하고 정확한 정보를 제공하세요."""

    full_prompt = f"""{system_prompt}

사용자 질문: {user_message}

한국어로만 답변 (영어/일본어/한자 절대 금지):"""

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "http://localhost:11434/api/generate",
                json={
                    "model": "llama3.1:8b",
                    "prompt": full_prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.1,
                        "top_p": 0.9,
                        "repeat_penalty": 1.3,
                        "num_predict": 300,
                    },
                },
            )
            result = response.json()
            return {"response": result.get("response", "응답을 생성할 수 없습니다.")}
    except httpx.ConnectError:
        return {"response": "Ollama 서버에 연결할 수 없습니다. `ollama run llama3.1:8b` 명령어로 서버를 시작해주세요."}
    except Exception as e:
        return {"response": f"오류가 발생했습니다: {str(e)}"}
