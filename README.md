# FullFit - 풀필먼트 운영 플랫폼

코스메틱 이커머스 셀러를 위한 멀티롤 풀필먼트 플랫폼

## 역할 구성
| 역할 | 설명 |
|------|------|
| ADMIN | FullFit 운영 관리자 (전체 접근) |
| WORKER | 창고 작업자 (피킹/포장/입출고) |
| SELLER | 셀러 (자신의 주문/재고/정산 조회) |

## 테스트 계정
| 이메일 | 비밀번호 | 역할 |
|--------|----------|------|
| admin@fullfit.com | admin1234 | ADMIN |
| worker@fullfit.com | worker1234 | WORKER |
| seller@fullfit.com | seller1234 | SELLER |

## 실행 방법

### 백엔드
```bash
cd C:\Users\임정림\Desktop\fullfit\backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 프론트엔드
```bash
cd C:\Users\임정림\Desktop\fullfit\frontend
npm install
npm run dev
```

- 백엔드: http://localhost:8000
- 프론트엔드: http://localhost:5173
- API 문서: http://localhost:8000/docs
