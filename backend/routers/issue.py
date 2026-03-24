from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session
from pydantic import BaseModel
from backend.database import get_db
from backend.models.user import User, UserRole
from backend.models.order_issue import OrderIssue
from backend.models.order import Order
from backend.core.dependencies import get_current_user, require_role

router = APIRouter()

ISSUE_TYPE_LABELS = {
    "STOCK_SHORTAGE":   "재고 부족",
    "ADDRESS_ERROR":    "주소 오류",
    "RETURN_DELAY":     "반품 지연",
    "EXPIRY_HOLD":      "유통기한 보류",
    "DAMAGE":           "파손/불량",
    "COURIER_ERROR":    "택배사 오류",
    "DUPLICATE_ORDER":  "중복 주문",
    "OTHER":            "기타",
}


class IssueCreate(BaseModel):
    order_id: Optional[int] = None
    seller_id: Optional[int] = None
    issue_type: str
    priority: str = "NORMAL"
    title: str
    description: Optional[str] = None
    assigned_to: Optional[str] = None


class IssueUpdate(BaseModel):
    status: Optional[str] = None
    resolution_note: Optional[str] = None
    assigned_to: Optional[str] = None


class IssueResponse(BaseModel):
    id: int
    order_id: Optional[int]
    order_number: Optional[str]
    seller_id: Optional[int]
    seller_name: Optional[str]
    issue_type: str
    issue_type_label: str
    priority: str
    status: str
    title: str
    description: Optional[str]
    assigned_to: Optional[str]
    resolved_at: Optional[datetime]
    resolution_note: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


def _to_response(issue: OrderIssue, db: Session) -> IssueResponse:
    order_number = None
    if issue.order_id:
        o = db.query(Order).filter(Order.id == issue.order_id).first()
        if o:
            order_number = o.order_number

    seller_name = None
    if issue.seller_id:
        s = db.query(User).filter(User.id == issue.seller_id).first()
        if s:
            seller_name = s.full_name

    return IssueResponse(
        id=issue.id,
        order_id=issue.order_id,
        order_number=order_number,
        seller_id=issue.seller_id,
        seller_name=seller_name,
        issue_type=issue.issue_type,
        issue_type_label=ISSUE_TYPE_LABELS.get(issue.issue_type, issue.issue_type),
        priority=issue.priority,
        status=issue.status,
        title=issue.title,
        description=issue.description,
        assigned_to=issue.assigned_to,
        resolved_at=issue.resolved_at,
        resolution_note=issue.resolution_note,
        created_at=issue.created_at,
        updated_at=issue.updated_at,
    )


@router.get("/issues/stats")
def get_issue_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN])),
):
    today = datetime.utcnow().date()
    total      = db.query(OrderIssue).count()
    open_cnt   = db.query(OrderIssue).filter(OrderIssue.status == "OPEN").count()
    in_prog    = db.query(OrderIssue).filter(OrderIssue.status == "IN_PROGRESS").count()
    critical   = db.query(OrderIssue).filter(OrderIssue.priority == "CRITICAL").count()
    high       = db.query(OrderIssue).filter(OrderIssue.priority == "HIGH").count()
    res_today  = db.query(OrderIssue).filter(
        OrderIssue.status == "RESOLVED",
        func.date(OrderIssue.resolved_at) == today,
    ).count()
    return {
        "total": total,
        "open": open_cnt,
        "in_progress": in_prog,
        "unresolved": open_cnt + in_prog,
        "resolved_today": res_today,
        "critical": critical,
        "high": high,
    }


@router.get("/issues/", response_model=List[IssueResponse])
def list_issues(
    status: Optional[str] = Query(None),
    issue_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(OrderIssue)
    if current_user.role == UserRole.SELLER:
        q = q.filter(OrderIssue.seller_id == current_user.id)
    if status:
        q = q.filter(OrderIssue.status == status)
    if issue_type:
        q = q.filter(OrderIssue.issue_type == issue_type)
    issues = q.order_by(OrderIssue.created_at.desc()).all()
    return [_to_response(i, db) for i in issues]


@router.post("/issues/", response_model=IssueResponse)
def create_issue(
    data: IssueCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    seller_id = data.seller_id
    if current_user.role == UserRole.SELLER:
        seller_id = current_user.id

    issue = OrderIssue(
        order_id=data.order_id,
        seller_id=seller_id,
        issue_type=data.issue_type,
        priority=data.priority,
        status="OPEN",
        title=data.title,
        description=data.description,
        assigned_to=data.assigned_to,
    )
    db.add(issue)
    db.commit()
    db.refresh(issue)
    return _to_response(issue, db)


@router.put("/issues/{issue_id}", response_model=IssueResponse)
def update_issue(
    issue_id: int,
    data: IssueUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN])),
):
    issue = db.query(OrderIssue).filter(OrderIssue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="이슈를 찾을 수 없습니다.")

    if data.status:
        issue.status = data.status
        if data.status in ("RESOLVED", "CLOSED"):
            issue.resolved_at = datetime.utcnow()
    if data.resolution_note is not None:
        issue.resolution_note = data.resolution_note
    if data.assigned_to is not None:
        issue.assigned_to = data.assigned_to
    issue.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(issue)
    return _to_response(issue, db)
