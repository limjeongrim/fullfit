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
