from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity_log import ActivityLog


async def log_activity(
    db: AsyncSession,
    task_id: int,
    user_id: int,
    action: str,
    detail: str = None,
):
    log = ActivityLog(
        task_id=task_id,
        user_id=user_id,
        action=action,
        detail=detail,
        timestamp=datetime.now(timezone.utc),
    )
    db.add(log)
    await db.flush()
