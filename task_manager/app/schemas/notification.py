from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class NotificationResponse(BaseModel):
    id: int
    task_id: Optional[int] = None
    type: str
    message: str
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}
