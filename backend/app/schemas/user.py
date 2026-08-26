from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserBase(BaseModel):
    email: EmailStr
    name: str = Field(..., min_length=2, max_length=100)


class UserCreate(UserBase):
    password: str = Field(..., min_length=6, max_length=100)
    role: Optional[str] = "CUSTOMER"


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(UserBase):
    id: str
    role: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    token: str
    user: UserResponse


class TokenPayload(BaseModel):
    userId: Optional[str] = None
    role: Optional[str] = None
