from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

from app.schemas.user import UserBriefResponse


class TeamCreate(BaseModel):
    name: str
    member_ids: List[int] = []


class TeamMemberAdd(BaseModel):
    user_ids: List[int]


class TeamManagerAdd(BaseModel):
    user_ids: List[int]


class TeamMemberResponse(BaseModel):
    id: int
    team_id: int
    user_id: int
    user: Optional[UserBriefResponse] = None

    model_config = {"from_attributes": True}


class TeamManagerResponse(BaseModel):
    id: int
    team_id: int
    user_id: int
    user: Optional[UserBriefResponse] = None

    model_config = {"from_attributes": True}


class TeamResponse(BaseModel):
    id: int
    name: str
    created_by: int
    created_at: datetime
    members: List[TeamMemberResponse] = []
    managers: List[TeamManagerResponse] = []

    model_config = {"from_attributes": True}
