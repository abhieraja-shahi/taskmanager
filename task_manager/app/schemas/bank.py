from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class BankCreate(BaseModel):
    name: str


class BankUpdate(BaseModel):
    name: Optional[str] = None


class BankResponse(BaseModel):
    id: int
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}
