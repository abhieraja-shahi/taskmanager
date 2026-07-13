import logging
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification

logger = logging.getLogger(__name__)

MESSAGES = {
    "ASSIGNED": "You have been assigned a new task: '{title}'.",
    "ACCEPTED": "Task '{title}' has been accepted by an assignee.",
    "REJECTED": "Task '{title}' was rejected. Reason: {reason}",
    "UNDER_REVIEW": "Task '{title}' is ready for your review.",
    "APPROVED": "Task '{title}' has been approved by the manager.",
    "REVIEW_REJECTED": "Task '{title}' was sent back for rework. Comment: {comment}",
    "DUE_SOON": "Reminder: Task '{title}' is due within 24 hours.",
    "OVERDUE": "Alert: Task '{title}' is overdue.",
    "COMMENT_ADDED": "{commenter} commented on task '{title}': {snippet}",
}


def _render_message(event: str, title: str, **kwargs) -> str:
    template = MESSAGES.get(event, "{event}: {title}")
    try:
        return template.format(title=title, event=event, **kwargs)
    except KeyError:
        return f"{event}: {title}"


async def notify(
    event: str,
    task,
    user_ids: Optional[List[int]] = None,
    manager_ids: Optional[List[int]] = None,
    db: Optional[AsyncSession] = None,
    **kwargs,
):
    """Persist notifications to DB and log them. Pass db= to persist; omit to log only."""
    all_recipients = list(set((user_ids or []) + (manager_ids or [])))
    if not all_recipients:
        return

    message = _render_message(event, task.title, **kwargs)
    logger.info(
        "NOTIFICATION [%s] task_id=%s recipients=%s | %s",
        event, task.id, all_recipients, message,
    )

    if db is not None:
        for uid in all_recipients:
            db.add(Notification(
                user_id=uid,
                task_id=task.id,
                type=event,
                message=message,
            ))
        await db.flush()


def send_reminder_notification(task, event: str, db=None):
    """Sync version for Celery tasks. Persists to DB when db= is provided."""
    assignee_ids = [
        a.user_id for a in task.assignments
        if a.status != "rejected"
    ]
    manager_ids = [task.created_by]
    all_recipients = list(set(assignee_ids + manager_ids))

    message = _render_message(event, task.title)
    logger.info(
        "REMINDER [%s] task_id=%s recipients=%s | %s",
        event, task.id, all_recipients, message,
    )

    if db is not None:
        for uid in all_recipients:
            db.add(Notification(
                user_id=uid,
                task_id=task.id,
                type=event,
                message=message,
            ))
