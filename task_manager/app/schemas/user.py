from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Literal


class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str


class UserBriefResponse(BaseModel):
    id: int
    username: str
    role: str

    model_config = {"from_attributes": True}


class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    role: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserRoleUpdate(BaseModel):
    role: Literal["user", "manager"]


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
