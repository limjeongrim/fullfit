import os
import shutil
from datetime import datetime, date
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models.return_request import ReturnRequest, ReturnStatus
from backend.models.order import Order, OrderStatus
from backend.models.inventory import Inventory
from backend.models.user import UserRole
from backend.schemas.return_request import ReturnCreate, ReturnResponse, ReturnStatusUpdate, ReturnItemInfo
from backend.core.dependencies import get_current_user, require_role
from backend.core.notify import create_notification
from backend.models.notification import NotificationType

router = APIRouter(prefix="/returns", tags=["Returns"])


def _to_response(r: ReturnRequest) -> ReturnResponse:
    items = [
        ReturnItemInfo(
            product_name=it.product.name,
            sku=it.product.sku,
            quantity=it.quantity,
        )
        for it in r.order.items
    ]
    return ReturnResponse(
        id=r.id,
        order_id=r.order_id,
        seller_id=r.seller_id,
        reason=r.reason,
        status=r.status,
        note=r.note,
        inspection_note=r.inspection_note,
        created_at=r.created_at,
        updated_at=r.updated_at,
        resolved_at=r.resolved_at,
        order_number=r.order.order_number,
        seller_name=r.seller.full_name,
        items=items,
    )


@router.get("/", response_model=list[ReturnResponse])
def list_all_returns(
    seller_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(require_role([UserRole.ADMIN])),
):
    q = db.query(ReturnRequest)
    if seller_id:
        q = q.filter(ReturnRequest.seller_id == seller_id)
    returns = q.order_by(ReturnRequest.created_at.desc()).all()
    return [_to_response(r) for r in returns]


@router.get("/seller", response_model=list[ReturnResponse])
def list_seller_returns(
    db: Session = Depends(get_db),
    current_user=Depends(require_role([UserRole.SELLER])),
):
    returns = (
        db.query(ReturnRequest)
        .filter(ReturnRequest.seller_id == current_user.id)
        .order_by(ReturnRequest.created_at.desc())
        .all()
    )
    return [_to_response(r) for r in returns]


@router.post("/", response_model=ReturnResponse, status_code=201)
def create_return(
    body: ReturnCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role([UserRole.SELLER])),
):
    order = db.query(Order).filter(Order.id == body.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="주문을 찾을 수 없습니다.")
    if order.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="본인의 주문만 반품 신청이 가능합니다.")
    if order.status != OrderStatus.DELIVERED:
        raise HTTPException(status_code=400, detail="배송 완료된 주문만 반품 신청이 가능합니다.")

    rr = ReturnRequest(
        order_id=body.order_id,
        seller_id=current_user.id,
        reason=body.reason,
        note=body.note,
    )
    db.add(rr)
    db.commit()
    db.refresh(rr)
    return _to_response(rr)


@router.patch("/{return_id}/status", response_model=ReturnResponse)
def update_return_status(
    return_id: int,
    body: ReturnStatusUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role([UserRole.ADMIN])),
):
    rr = db.query(ReturnRequest).filter(ReturnRequest.id == return_id).first()
    if not rr:
        raise HTTPException(status_code=404, detail="반품 요청을 찾을 수 없습니다.")

    rr.status = body.status
    if body.inspection_note is not None:
        rr.inspection_note = body.inspection_note
    rr.updated_at = datetime.utcnow()

    if body.status in (ReturnStatus.RESTOCKED, ReturnStatus.DISPOSED):
        rr.resolved_at = datetime.utcnow()
        result_label = "재입고 완료" if body.status == ReturnStatus.RESTOCKED else "폐기 처리 완료"
        create_notification(
            db, rr.seller_id, NotificationType.RETURN_PROCESSED,
            f"반품 처리 완료 - {result_label}",
            f"주문 {rr.order.order_number}의 반품이 {result_label}되었습니다.",
        )

    if body.status == ReturnStatus.RESTOCKED:
        # Find the latest inventory LOT for the first order item's product
        order = rr.order
        if order.items:
            first_item = order.items[0]
            lot = (
                db.query(Inventory)
                .filter(Inventory.product_id == first_item.product_id)
                .order_by(Inventory.created_at.desc())
                .first()
            )
            if lot:
                lot.quantity += first_item.quantity

    db.commit()
    db.refresh(rr)
    return _to_response(rr)


@router.post("/{return_id}/inspect")
async def inspect_return(
    return_id: int,
    action: str = Form(...),
    grade: str = Form(...),
    note: str = Form(""),
    photo_0: UploadFile = File(None),
    photo_1: UploadFile = File(None),
    photo_2: UploadFile = File(None),
    db: Session = Depends(get_db),
    current_user=Depends(require_role([UserRole.ADMIN])),
):
    rr = db.query(ReturnRequest).filter(ReturnRequest.id == return_id).first()
    if not rr:
        raise HTTPException(status_code=404, detail="반품 요청을 찾을 수 없습니다.")

    upload_dir = f"uploads/returns/{return_id}"
    os.makedirs(upload_dir, exist_ok=True)
    photo_paths = []
    for photo in [photo_0, photo_1, photo_2]:
        if photo and photo.filename:
            safe_name = os.path.basename(photo.filename)
            path = f"{upload_dir}/{safe_name}"
            with open(path, "wb") as f:
                shutil.copyfileobj(photo.file, f)
            photo_paths.append(path)

    rr.inspection_grade = grade
    rr.inspection_note = note or None
    rr.inspection_photos = ",".join(photo_paths) if photo_paths else None
    rr.inspected_at = date.today()
    rr.updated_at = datetime.utcnow()
    rr.resolved_at = datetime.utcnow()

    if action == "RESTOCK":
        rr.status = ReturnStatus.RESTOCKED
        if grade in ("A", "B") and rr.order and rr.order.items:
            first_item = rr.order.items[0]
            lot = (
                db.query(Inventory)
                .filter(Inventory.product_id == first_item.product_id)
                .order_by(Inventory.created_at.desc())
                .first()
            )
            if lot:
                lot.quantity += first_item.quantity
    else:
        rr.status = ReturnStatus.DISPOSED

    result_label = "재입고 완료" if action == "RESTOCK" else "폐기 처리 완료"
    create_notification(
        db, rr.seller_id, NotificationType.RETURN_PROCESSED,
        f"반품 처리 완료 - {result_label}",
        f"주문 {rr.order.order_number}의 반품이 {result_label}되었습니다. (등급: {grade}등급)",
    )

    db.commit()
    return {"success": True, "action": action, "grade": grade}
