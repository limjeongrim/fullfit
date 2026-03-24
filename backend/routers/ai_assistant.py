from datetime import date
import httpx
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models.order import Order, OrderStatus
from backend.models.product import Product
from backend.models.inventory import Inventory
from backend.models.order_issue import OrderIssue
from backend.core.dependencies import get_current_user

router = APIRouter(prefix="/ai", tags=["ai"])


@router.get("/context")
async def get_context(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    received = db.query(Order).filter(Order.status == OrderStatus.RECEIVED).count()
    picking = db.query(Order).filter(Order.status == OrderStatus.PICKING).count()
    packed = db.query(Order).filter(Order.status == OrderStatus.PACKED).count()
    shipped = db.query(Order).filter(Order.status == OrderStatus.SHIPPED).count()

    low_stock = (
        db.query(Product)
        .join(Inventory, Inventory.product_id == Product.id)
        .filter(Inventory.quantity < 20)
        .all()
    )

    open_issues = db.query(OrderIssue).filter(OrderIssue.status == "OPEN").count()

    return {
        "오늘날짜": str(date.today()),
        "주문현황": {
            "주문접수": received,
            "출고준비중": picking,
            "패킹완료": packed,
            "출고완료": shipped,
        },
        "재고부족상품": [
            {
                "상품명": p.name,
                "SKU": p.sku,
                "재고": p.inventories[0].quantity if p.inventories else 0,
            }
            for p in low_stock[:5]
        ],
        "미해결이슈": open_issues,
    }


@router.post("/chat")
async def chat(
    request: dict,
    current_user=Depends(get_current_user),
):
    user_message = request.get("message", "")
    context = request.get("context", {})

    system_prompt = f"""당신은 FullFit 화장품 풀필먼트 센터의 AI 운영 어시스턴트입니다.

현재 운영 데이터:
{context}

역할:
- 재고 현황 분석 및 위험 알림
- 수요 예측 기반 입고 추천
- 출고/배송 현황 요약
- 반품 및 이슈 현황 파악
- 셀러별 운영 성과 분석

한국어로 간결하고 실무적으로 답변하세요.
숫자는 정확하게, 추천은 근거와 함께 2-3문장으로 답하세요."""

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "http://localhost:11434/api/generate",
                json={
                    "model": "llama3.2",
                    "prompt": f"System: {system_prompt}\n\nUser: {user_message}",
                    "stream": False,
                },
            )
            result = response.json()
            return {"response": result.get("response", "응답을 생성할 수 없습니다.")}
    except httpx.ConnectError:
        return {"response": "Ollama 서버에 연결할 수 없습니다. `ollama run llama3.2` 명령어로 서버를 시작해주세요."}
    except Exception as e:
        return {"response": f"오류가 발생했습니다: {str(e)}"}
