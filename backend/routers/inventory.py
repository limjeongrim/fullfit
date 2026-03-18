from datetime import date, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models.user import User, UserRole
from backend.models.product import Product
from backend.models.inventory import Inventory
from backend.models.inbound import Inbound
from backend.schemas.inventory import (
    ProductCreate, ProductResponse,
    InboundCreate, InboundResponse,
    InventoryResponse,
)
from backend.core.dependencies import require_role
from backend.core.notify import create_notification
from backend.models.notification import NotificationType
from backend.models.user import UserRole as _UserRole

router = APIRouter()


def _to_inv_response(inv: Inventory) -> InventoryResponse:
    return InventoryResponse(
        id=inv.id,
        product_id=inv.product_id,
        product_name=inv.product.name,
        sku=inv.product.sku,
        storage_type=inv.product.storage_type,
        lot_number=inv.lot_number,
        expiry_date=inv.expiry_date,
        quantity=inv.quantity,
        location=inv.location,
        inbound_date=inv.inbound_date,
        days_until_expiry=(inv.expiry_date - date.today()).days,
    )


# ── Inventory endpoints ────────────────────────────────────────────────────────

@router.get("/inventory/", response_model=List[InventoryResponse])
def list_inventory(
    seller_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.WORKER])),
):
    q = db.query(Inventory).join(Product)
    if seller_id:
        q = q.filter(Product.seller_id == seller_id)
    rows = q.order_by(Inventory.expiry_date.asc()).all()
    return [_to_inv_response(inv) for inv in rows]


@router.get("/inventory/seller", response_model=List[InventoryResponse])
def list_inventory_seller(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.SELLER])),
):
    rows = (
        db.query(Inventory)
        .join(Product)
        .filter(Product.seller_id == current_user.id)
        .order_by(Inventory.expiry_date.asc())
        .all()
    )
    return [_to_inv_response(inv) for inv in rows]


@router.get("/inventory/alerts", response_model=List[InventoryResponse])
def list_expiry_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN])),
):
    threshold = date.today() + timedelta(days=30)
    rows = (
        db.query(Inventory)
        .join(Product)
        .filter(Inventory.expiry_date <= threshold)
        .order_by(Inventory.expiry_date.asc())
        .all()
    )
    return [_to_inv_response(inv) for inv in rows]


@router.get("/inventory/inbound/seller", response_model=List[InboundResponse])
def list_inbound_seller(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.SELLER])),
):
    rows = (
        db.query(Inbound)
        .join(Product, Inbound.product_id == Product.id)
        .filter(Product.seller_id == current_user.id)
        .order_by(Inbound.created_at.desc())
        .limit(10)
        .all()
    )
    return [
        InboundResponse(
            id=r.id,
            product_id=r.product_id,
            product_name=r.product.name,
            lot_number=r.lot_number,
            expiry_date=r.expiry_date,
            quantity=r.quantity,
            inbound_date=r.inbound_date,
            note=r.note,
            created_by=r.created_by,
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.post("/inventory/inbound", response_model=InboundResponse)
def register_inbound(
    data: InboundCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.WORKER, UserRole.SELLER])),
):
    product = db.query(Product).filter(Product.id == data.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="상품을 찾을 수 없습니다.")
    if current_user.role == UserRole.SELLER and product.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="자신의 상품만 입고 요청할 수 있습니다.")

    # Create inbound record
    inbound = Inbound(
        product_id=data.product_id,
        lot_number=data.lot_number,
        expiry_date=data.expiry_date,
        quantity=data.quantity,
        inbound_date=date.today(),
        note=data.note,
        created_by=current_user.id,
    )
    db.add(inbound)

    # Upsert inventory LOT row
    inv = (
        db.query(Inventory)
        .filter(
            Inventory.product_id == data.product_id,
            Inventory.lot_number == data.lot_number,
        )
        .first()
    )
    if inv:
        inv.quantity += data.quantity
    else:
        inv = Inventory(
            product_id=data.product_id,
            lot_number=data.lot_number,
            expiry_date=data.expiry_date,
            quantity=data.quantity,
            inbound_date=date.today(),
        )
        db.add(inv)

    db.commit()
    db.refresh(inbound)

    # Notify if stock is low after inbound (edge case: lot qty was subtracted elsewhere)
    total_stock = db.query(func.sum(Inventory.quantity)).filter(Inventory.product_id == data.product_id).scalar() or 0
    if total_stock < 50:
        admins = db.query(User).filter(User.role == _UserRole.ADMIN).all()
        for admin in admins:
            create_notification(
                db, admin.id, NotificationType.STOCK_LOW,
                f"재고 부족: {product.name}",
                f"{product.name} ({product.sku}) 재고가 {total_stock}개로 부족합니다.",
            )
        create_notification(
            db, product.seller_id, NotificationType.STOCK_LOW,
            f"재고 부족: {product.name}",
            f"{product.name} ({product.sku}) 재고가 {total_stock}개로 부족합니다.",
        )
        db.commit()

    return InboundResponse(
        id=inbound.id,
        product_id=inbound.product_id,
        product_name=product.name,
        lot_number=inbound.lot_number,
        expiry_date=inbound.expiry_date,
        quantity=inbound.quantity,
        inbound_date=inbound.inbound_date,
        note=inbound.note,
        created_by=inbound.created_by,
        created_at=inbound.created_at,
    )


# ── Product endpoints ──────────────────────────────────────────────────────────

@router.get("/products/", response_model=List[ProductResponse])
def list_products(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.WORKER])),
):
    return db.query(Product).filter(Product.is_active == True).all()


@router.get("/products/seller", response_model=List[ProductResponse])
def list_products_seller(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.SELLER])),
):
    return (
        db.query(Product)
        .filter(Product.seller_id == current_user.id, Product.is_active == True)
        .all()
    )


@router.post("/products/", response_model=ProductResponse)
def create_product(
    data: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN])),
):
    if db.query(Product).filter(Product.sku == data.sku).first():
        raise HTTPException(status_code=400, detail="이미 존재하는 SKU입니다.")
    product = Product(**data.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product
