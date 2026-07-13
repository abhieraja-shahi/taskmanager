from datetime import datetime, timedelta, timezone
from app.config import settings

from celery import Celery
from celery.schedules import crontab

celery = Celery("task_manager", broker=settings.REDIS_URL)
celery.conf.timezone = "UTC"

celery.conf.beat_schedule = {
    "check-due-dates": {
        "task": "app.workers.celery_tasks.check_due_dates",
        "schedule": crontab(hour="8", minute="0"),  # daily at 8 AM UTC
    }
}


@celery.task(name="app.workers.celery_tasks.check_due_dates")
def check_due_dates():
    from sqlalchemy.orm import joinedload

    from app.database import SyncSessionLocal
    from app.models.task import Task, TaskStatus
    from app.services.notification_service import send_reminder_notification

    with SyncSessionLocal() as db:
        now = datetime.now(timezone.utc)
        soon = now + timedelta(hours=24)

        # Tasks nearing due date (due within the next 24 hours)
        tasks_due_soon = (
            db.query(Task)
            .options(joinedload(Task.assignments))
            .filter(
                Task.due_date > now,
                Task.due_date <= soon,
                Task.status.in_([
                    TaskStatus.IN_PROGRESS.value,
                    TaskStatus.PENDING_ACCEPTANCE.value,
                ]),
            )
            .all()
        )
        for task in tasks_due_soon:
            send_reminder_notification(task, "DUE_SOON", db=db)

        # Overdue tasks (past due date and still active)
        overdue_tasks = (
            db.query(Task)
            .options(joinedload(Task.assignments))
            .filter(
                Task.due_date < now,
                Task.status.in_([
                    TaskStatus.IN_PROGRESS.value,
                    TaskStatus.PENDING_ACCEPTANCE.value,
                ]),
            )
            .all()
        )
        for task in overdue_tasks:
            send_reminder_notification(task, "OVERDUE", db=db)

        db.commit()
