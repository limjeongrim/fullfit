from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models.inventory import Inventory
from backend.models.inventory_adjustment import InventoryAdjustment, AdjustmentType
from backend.models.user import UserRole
from backend.core.dependencies import require_role

router = APIRouter(tags=["InventoryAdjust"])


class AdjustItem(BaseModel):
    inventory_id: int
    adjustment_type: AdjustmentType
    value: int  # quantity to add/subtract/set to
    reason: Optional[str] = None


class BulkAdjustRequest(BaseModel):
    items: List[AdjustItem]


class AdjustmentResponse(BaseModel):
    id: int
    inventory_id: int
    product_name: str
    sku: str
    lot_number: str
    adjustment_type: AdjustmentType
    quantity_before: int
    quantity_after: int
    delta: int
    reason: Optional[str]
    adjusted_by_name: str
    created_at: str

    class Config:
        from_attributes = True


@router.post("/inventory/adjust", response_model=List[AdjustmentResponse])
def adjust_inventory(
    body: BulkAdjustRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_role([UserRole.ADMIN])),
):
    results = []
    for item in body.items:
        inv = db.query(Inventory).filter(Inventory.id == item.inventory_id).first()
        if not inv:
            raise HTTPException(status_code=404, detail=f"재고 ID {item.inventory_id}을(를) 찾을 수 없습니다.")

        qty_before = inv.quantity
        if item.adjustment_type == AdjustmentType.ADD:
            qty_after = qty_before + item.value
        elif item.adjustment_type == AdjustmentType.SUBTRACT:
            qty_after = max(0, qty_before - item.value)
        else:  # SET
            qty_after = item.value

        delta = qty_after - qty_before
        inv.quantity = qty_after

        adj = InventoryAdjustment(
            inventory_id=inv.id,
            adjusted_by=current_user.id,
            adjustment_type=item.adjustment_type,
            quantity_before=qty_before,
            quantity_after=qty_after,
            delta=delta,
            reason=item.reason,
        )
        db.add(adj)
        db.flush()

        results.append(AdjustmentResponse(
            id=adj.id,
            inventory_id=inv.id,
            product_name=inv.product.name,
            sku=inv.product.sku,
            lot_number=inv.lot_number,
            adjustment_type=item.adjustment_type,
            quantity_before=qty_before,
            quantity_after=qty_after,
            delta=delta,
            reason=item.reason,
            adjusted_by_name=current_user.full_name,
            created_at=adj.created_at.isoformat(),
        ))

    db.commit()
    return results


@router.get("/inventory/adjustments", response_model=List[AdjustmentResponse])
def list_adjustments(
    limit: int = 100,
    db: Session = Depends(get_db),
    _=Depends(require_role([UserRole.ADMIN])),
):
    rows = (
        db.query(InventoryAdjustment)
        .order_by(InventoryAdjustment.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        AdjustmentResponse(
            id=r.id,
            inventory_id=r.inventory_id,
            product_name=r.inventory.product.name,
            sku=r.inventory.product.sku,
            lot_number=r.inventory.lot_number,
            adjustment_type=r.adjustment_type,
            quantity_before=r.quantity_before,
            quantity_after=r.quantity_after,
            delta=r.delta,
            reason=r.reason,
            adjusted_by_name=r.adjuster.full_name if r.adjuster else '',
            created_at=r.created_at.isoformat(),
        )
        for r in rows
    ]
