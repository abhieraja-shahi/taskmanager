from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.schemas.user import UserBriefResponse


class AttachmentResponse(BaseModel):
    id: int
    task_id: int
    filename: str
    file_size: int
    content_type: str
    uploaded_by: int
    uploader: Optional[UserBriefResponse] = None
    uploaded_at: datetime

    model_config = {"from_attributes": True}
