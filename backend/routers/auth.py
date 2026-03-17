from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models.user import User, UserRole
from backend.schemas.auth import LoginRequest, TokenResponse, UserResponse, RefreshRequest, SellerRegister, SellerResponse
from backend.core.security import verify_password, create_access_token, create_refresh_token, decode_token, hash_password
from backend.core.dependencies import get_current_user, require_role

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == request.email).first()
    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="이메일 또는 비밀번호가 올바르지 않습니다."
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="비활성화된 계정입니다.")

    token_data = {"sub": str(user.id), "role": user.role.value}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        token_type="bearer",
        role=user.role,
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(request: RefreshRequest, db: Session = Depends(get_db)):
    payload = decode_token(request.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    token_data = {"sub": str(user.id), "role": user.role.value}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        token_type="bearer",
        role=user.role,
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/register", response_model=SellerResponse, status_code=201)
def register_seller(
    body: SellerRegister,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN])),
):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=400, detail="이미 사용 중인 이메일입니다.")
    seller = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        role=UserRole.SELLER,
        full_name=body.full_name,
        company_name=body.company_name,
        business_number=body.business_number,
        is_active=True,
        joined_at=datetime.utcnow(),
    )
    db.add(seller)
    db.commit()
    db.refresh(seller)
    return seller
