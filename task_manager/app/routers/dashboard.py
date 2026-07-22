from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_manager
from app.models.task import Task, TaskStatus
from app.models.task_assignment import TaskAssignment
from app.models.team import Team, TeamMember, TeamManager
from app.models.user import User, UserRole
from app.schemas.task import TaskSummaryResponse

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/manager", response_model=List[TaskSummaryResponse])
async def manager_dashboard(
    status: Optional[str] = Query(None, description="Filter by task status"),
    user_id: Optional[int] = Query(None, description="Filter by assigned user"),
    team_id: Optional[int] = Query(None, description="Filter by assigned team"),
    from_date: Optional[date] = Query(None, description="Created on or after this date"),
    to_date: Optional[date] = Query(None, description="Created on or before this date"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    manager: User = Depends(require_manager),
):
    query = select(Task).options(
        selectinload(Task.creator),
        selectinload(Task.assignments).selectinload(TaskAssignment.user),
    )

    # Admins see all tasks; managers see only tasks assigned to members of their teams
    if manager.role != UserRole.ADMIN.value:
        managed_task_ids = (
            select(TaskAssignment.task_id)
            .join(TeamMember, TaskAssignment.user_id == TeamMember.user_id)
            .join(Team, TeamMember.team_id == Team.id)
            .join(TeamManager, Team.id == TeamManager.team_id)
            .where(TeamManager.user_id == manager.id)
        )
        query = query.where(Task.id.in_(managed_task_ids))

    if status:
        query = query.where(Task.status == status)

    if from_date:
        query = query.where(Task.created_at >= datetime.combine(from_date, datetime.min.time()))
    if to_date:
        query = query.where(Task.created_at <= datetime.combine(to_date, datetime.max.time()))

    if user_id:
        query = (
            query
            .join(TaskAssignment, Task.id == TaskAssignment.task_id)
            .where(TaskAssignment.user_id == user_id)
        )
    elif team_id:
        member_subq = (
            select(TeamMember.user_id)
            .where(TeamMember.team_id == team_id)
            .scalar_subquery()
        )
        query = (
            query
            .join(TaskAssignment, Task.id == TaskAssignment.task_id)
            .where(TaskAssignment.user_id.in_(member_subq))
        )

    query = query.distinct().order_by(Task.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/user", response_model=List[TaskSummaryResponse])
async def user_dashboard(
    status: Optional[str] = Query(None, description="Filter by task status"),
    from_date: Optional[date] = Query(None, description="Due on or after this date"),
    to_date: Optional[date] = Query(None, description="Due on or before this date"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = (
        select(Task, TaskAssignment.status.label("assignment_status"))
        .join(TaskAssignment, Task.id == TaskAssignment.task_id)
        .where(TaskAssignment.user_id == user.id)
        .options(selectinload(Task.creator))
    )

    if status:
        query = query.where(Task.status == status)
    else:
        query = query.where(
            Task.status.in_([
                TaskStatus.PENDING_ACCEPTANCE.value,
                TaskStatus.IN_PROGRESS.value,
                TaskStatus.UNDER_REVIEW.value,
            ])
        )

    if from_date:
        query = query.where(Task.due_date >= datetime.combine(from_date, datetime.min.time()))
    if to_date:
        query = query.where(Task.due_date <= datetime.combine(to_date, datetime.max.time()))

    query = query.order_by(Task.due_date.asc()).offset(skip).limit(limit)
    result = await db.execute(query)
    rows = result.all()

    output = []
    for row in rows:
        task_dict = TaskSummaryResponse.model_validate(row.Task).model_dump()
        task_dict["my_assignment_status"] = row.assignment_status
        output.append(task_dict)
    return output
