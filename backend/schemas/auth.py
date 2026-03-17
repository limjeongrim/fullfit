from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr
from backend.models.user import UserRole


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: UserRole


class UserResponse(BaseModel):
    id: int
    email: str
    role: UserRole
    full_name: str

    class Config:
        from_attributes = True


class RefreshRequest(BaseModel):
    refresh_token: str


class SellerRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    company_name: Optional[str] = None
    business_number: Optional[str] = None


class SellerResponse(BaseModel):
    id: int
    email: str
    full_name: str
    company_name: Optional[str]
    business_number: Optional[str]
    is_active: bool
    joined_at: Optional[datetime]

    class Config:
        from_attributes = True
