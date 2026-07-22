from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_current_user, require_manager
from app.models.activity_log import ActivityLog
from app.models.comment import Comment
from app.models.task import Task, TaskStatus
from app.models.task_assignment import TaskAssignment
from app.models.team import Team, TeamMember, TeamManager
from app.models.user import User, UserRole
from app.schemas.task import (
    ActivityLogWithUserResponse,
    CommentResponse,
    CommentSchema,
    RejectSchema,
    ReassignSchema,
    ReviewSchema,
    TaskCreateSchema,
    TaskUpdateSchema,
    TaskResponse,
    TaskSummaryResponse,
)
from app.services.activity_service import log_activity
from app.services.notification_service import notify
from app.services.task_service import TaskService

router = APIRouter(prefix="/tasks", tags=["tasks"])
_service = TaskService()


@router.post("/", response_model=TaskResponse, status_code=201)
async def create_task(
    data: TaskCreateSchema,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_manager),
):
    return await _service.create_task(db, data, creator=user)


@router.get("/", response_model=List[TaskSummaryResponse])
async def list_tasks(
    status: Optional[str] = Query(None),
    due_from: Optional[date] = Query(None, description="Filter by due date on or after"),
    due_to: Optional[date] = Query(None, description="Filter by due date on or before"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_manager),
):
    query = select(Task).options(
        selectinload(Task.creator),
        selectinload(Task.assignments).selectinload(TaskAssignment.user),
    )

    if user.role != UserRole.ADMIN.value:
        managed_task_ids = (
            select(TaskAssignment.task_id)
            .join(TeamMember, TaskAssignment.user_id == TeamMember.user_id)
            .join(TeamManager, TeamMember.team_id == TeamManager.team_id)
            .where(TeamManager.user_id == user.id)
        )
        query = query.where(Task.id.in_(managed_task_ids))

    if status:
        query = query.where(Task.status == status)
    if due_from:
        query = query.where(Task.due_date >= datetime.combine(due_from, datetime.min.time()))
    if due_to:
        query = query.where(Task.due_date <= datetime.combine(due_to, datetime.max.time()))

    query = query.order_by(Task.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Task)
        .options(
            selectinload(Task.assignments).selectinload(TaskAssignment.user),
            selectinload(Task.comments).selectinload(Comment.user),
            selectinload(Task.creator),
            selectinload(Task.reviewer),
            selectinload(Task.banks),
        )
        .where(Task.id == task_id)
    )
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: int,
    data: TaskUpdateSchema,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_manager),
):
    return await _service.update_task(db, task_id, data, user)


@router.put("/{task_id}/assignments", response_model=TaskResponse)
async def reassign_task(
    task_id: int,
    data: ReassignSchema,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_manager),
):
    return await _service.reassign_task(db, task_id, data.assignee_ids, user)


@router.post("/{task_id}/accept", response_model=TaskResponse)
async def accept_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await _service.accept_task(db, task_id, user.id)


@router.post("/{task_id}/reject", response_model=TaskResponse)
async def reject_task(
    task_id: int,
    body: RejectSchema,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await _service.reject_task(db, task_id, user.id, body.reason)


@router.post("/{task_id}/complete", response_model=TaskResponse)
async def complete_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await _service.complete_task_by_user(db, task_id, user.id)


@router.post("/{task_id}/review", response_model=TaskResponse)
async def review_task(
    task_id: int,
    body: ReviewSchema,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_manager),
):
    return await _service.manager_review(db, task_id, user.id, body.approved, body.comment)


@router.post("/{task_id}/comments", response_model=CommentResponse, status_code=201)
async def add_comment(
    task_id: int,
    body: CommentSchema,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Task).options(selectinload(Task.assignments)).where(Task.id == task_id)
    )
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    comment = Comment(task_id=task_id, user_id=user.id, content=body.content)
    db.add(comment)
    await log_activity(db, task_id, user.id, "COMMENT_ADDED", detail=body.content[:200])

    # Notify all concerned people (assignees + task creator) except the commenter
    assignee_ids = [a.user_id for a in task.assignments if a.status != "rejected"]
    recipient_ids = list(set(assignee_ids + [task.created_by]) - {user.id})
    if recipient_ids:
        snippet = body.content[:100] + ("..." if len(body.content) > 100 else "")
        await notify(
            "COMMENT_ADDED", task, user_ids=recipient_ids, db=db,
            commenter=user.username, snippet=snippet,
        )

    await db.commit()
    comment_result = await db.execute(
        select(Comment).options(selectinload(Comment.user)).where(Comment.id == comment.id)
    )
    return comment_result.scalar_one()


@router.get("/{task_id}/comments", response_model=List[CommentResponse])
async def get_comments(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Comment)
        .options(selectinload(Comment.user))
        .where(Comment.task_id == task_id)
        .order_by(Comment.created_at)
    )
    return result.scalars().all()


@router.get("/{task_id}/activity", response_model=List[ActivityLogWithUserResponse])
async def get_activity_log(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ActivityLog)
        .options(selectinload(ActivityLog.user))
        .where(ActivityLog.task_id == task_id)
        .order_by(ActivityLog.timestamp)
    )
    return result.scalars().all()
