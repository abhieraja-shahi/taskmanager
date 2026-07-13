from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List

from app.schemas.bank import BankResponse
from app.schemas.user import UserBriefResponse


class TaskCreateSchema(BaseModel):
    title: str
    description: Optional[str] = None
    due_date: datetime
    start_date: Optional[datetime] = None
    assignee_ids: List[int] = []
    team_ids: List[int] = []
    bank_ids: List[int] = []
    zammad_ticket_id: Optional[int] = None


class TaskUpdateSchema(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    start_date: Optional[datetime] = None
    bank_ids: Optional[List[int]] = None


class ReassignSchema(BaseModel):
    assignee_ids: List[int]


class RejectSchema(BaseModel):
    reason: str


class ReviewSchema(BaseModel):
    approved: bool
    comment: Optional[str] = None


class CommentSchema(BaseModel):
    content: str


class AssignmentResponse(BaseModel):
    id: int
    task_id: int
    user_id: int
    user: Optional[UserBriefResponse] = None
    status: str
    rejection_reason: Optional[str] = None
    accepted_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class CommentResponse(BaseModel):
    id: int
    task_id: int
    user_id: int
    user: Optional[UserBriefResponse] = None
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TaskBriefResponse(BaseModel):
    id: int
    title: str

    model_config = {"from_attributes": True}


class TaskBriefWithStatusResponse(BaseModel):
    id: int
    title: str
    status: str
    due_date: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


class AssignmentWithTaskResponse(BaseModel):
    id: int
    task_id: int
    user_id: int
    user: Optional[UserBriefResponse] = None
    task: Optional[TaskBriefWithStatusResponse] = None
    status: str
    rejection_reason: Optional[str] = None
    accepted_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ActivityLogResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    action: str
    detail: Optional[str] = None
    timestamp: datetime

    model_config = {"from_attributes": True}


class ActivityLogDetailResponse(BaseModel):
    id: int
    task_id: int
    task: Optional[TaskBriefResponse] = None
    user_id: Optional[int] = None
    user: Optional[UserBriefResponse] = None
    action: str
    detail: Optional[str] = None
    timestamp: datetime

    model_config = {"from_attributes": True}


class ActivityLogWithUserResponse(BaseModel):
    id: int
    task_id: int
    user_id: Optional[int] = None
    user: Optional[UserBriefResponse] = None
    action: str
    detail: Optional[str] = None
    timestamp: datetime

    model_config = {"from_attributes": True}


class TaskResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    due_date: datetime
    start_date: Optional[datetime] = None
    status: str
    created_by: int
    creator: Optional[UserBriefResponse] = None
    reviewed_by: Optional[int] = None
    reviewer: Optional[UserBriefResponse] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    zammad_ticket_id: Optional[int] = None
    assignments: List[AssignmentResponse] = []
    comments: List[CommentResponse] = []
    banks: List[BankResponse] = []

    model_config = {"from_attributes": True}


class TaskSummaryResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    due_date: datetime
    start_date: Optional[datetime] = None
    status: str
    created_by: int
    creator: Optional[UserBriefResponse] = None
    reviewed_by: Optional[int] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    zammad_ticket_id: Optional[int] = None
    my_assignment_status: Optional[str] = None

    model_config = {"from_attributes": True}
