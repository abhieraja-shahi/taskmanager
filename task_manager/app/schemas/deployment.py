from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List

from app.schemas.user import UserBriefResponse
from app.schemas.bank import BankResponse


class TaskBriefResponse(BaseModel):
    id: int
    title: str
    status: str

    model_config = {"from_attributes": True}


class DeploymentCreate(BaseModel):
    artifact_type: str
    software_version: str
    name: str
    purpose: str
    deployed_by_id: Optional[int] = None
    deployed_at: Optional[datetime] = None
    bank_ids: List[int] = []
    task_ids: List[int] = []


class DeploymentResponse(BaseModel):
    id: int
    artifact_type: str
    software_version: str
    name: str
    purpose: str
    script_filename: Optional[str] = None
    script_file_size: Optional[int] = None
    script_content_type: Optional[str] = None
    deployed_by_id: int
    deployed_by: Optional[UserBriefResponse] = None
    deployed_at: Optional[datetime] = None
    banks: List[BankResponse] = []
    tasks: List[TaskBriefResponse] = []
    created_at: datetime

    model_config = {"from_attributes": True}
