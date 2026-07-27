from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, case, func, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_manager
from app.models.task import Task, TaskStatus
from app.models.task_assignment import TaskAssignment
from app.models.team import Team, TeamMember, TeamManager
from app.models.user import User, UserRole
from app.schemas.task import ManagerDashboardResponse, PaginatedTaskResponse, TaskSummaryResponse

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

_INACTIVE = ('approved', 'rejected')


@router.get("/manager", response_model=ManagerDashboardResponse)
async def manager_dashboard(
    status: Optional[str] = Query(None, description="Filter by task status"),
    user_id: Optional[int] = Query(None, description="Filter by assigned user"),
    team_id: Optional[int] = Query(None, description="Filter by assigned team"),
    from_date: Optional[date] = Query(None, description="Created on or after this date"),
    to_date: Optional[date] = Query(None, description="Created on or before this date"),
    skip: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    manager: User = Depends(require_manager),
):
    # Scope filter: admins see all; managers see tasks assigned to members of their teams
    scope_filter = None
    if manager.role != UserRole.ADMIN.value:
        managed_task_ids = (
            select(TaskAssignment.task_id)
            .join(TeamMember, TaskAssignment.user_id == TeamMember.user_id)
            .join(Team, TeamMember.team_id == Team.id)
            .join(TeamManager, Team.id == TeamManager.team_id)
            .where(TeamManager.user_id == manager.id)
        )
        scope_filter = Task.id.in_(managed_task_ids)

    # ── Aggregate stats (scope only, no user filters) ──────────────────────
    now = datetime.utcnow()
    stats_q = select(
        func.count(case((Task.status.not_in(_INACTIVE), 1))).label("active"),
        func.count(case((Task.status == "in_progress", 1))).label("in_progress"),
        func.count(case((Task.status == "pending_acceptance", 1))).label("pending"),
        func.count(case((
            and_(Task.status.not_in(_INACTIVE), Task.due_date < now), 1
        ))).label("overdue"),
    )
    if scope_filter is not None:
        stats_q = stats_q.where(scope_filter)
    stats_row = (await db.execute(stats_q)).one()

    # ── Filtered + paginated items ──────────────────────────────────────────
    query = select(Task).options(
        selectinload(Task.creator),
        selectinload(Task.assignments).selectinload(TaskAssignment.user),
    )
    if scope_filter is not None:
        query = query.where(scope_filter)

    if status:
        query = query.where(Task.status == status)
    if from_date:
        query = query.where(Task.created_at >= datetime.combine(from_date, datetime.min.time()))
    if to_date:
        query = query.where(Task.created_at <= datetime.combine(to_date, datetime.max.time()))
    if user_id:
        query = (
            query.join(TaskAssignment, Task.id == TaskAssignment.task_id)
            .where(TaskAssignment.user_id == user_id)
        )
    elif team_id:
        member_subq = (
            select(TeamMember.user_id)
            .where(TeamMember.team_id == team_id)
            .scalar_subquery()
        )
        query = (
            query.join(TaskAssignment, Task.id == TaskAssignment.task_id)
            .where(TaskAssignment.user_id.in_(member_subq))
        )

    base_q = query.distinct()
    total = (await db.execute(select(func.count()).select_from(base_q.subquery()))).scalar_one()
    items_q = base_q.order_by(Task.created_at.desc()).offset(skip).limit(limit)
    items = (await db.execute(items_q)).scalars().all()

    return ManagerDashboardResponse(
        items=items,
        total=total,
        active_count=stats_row.active,
        in_progress_count=stats_row.in_progress,
        pending_count=stats_row.pending,
        overdue_count=stats_row.overdue,
    )


@router.get("/user", response_model=PaginatedTaskResponse)
async def user_dashboard(
    status: Optional[str] = Query(None, description="Filter by task status"),
    from_date: Optional[date] = Query(None, description="Due on or after this date"),
    to_date: Optional[date] = Query(None, description="Due on or before this date"),
    skip: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    base = (
        select(Task, TaskAssignment.status.label("assignment_status"))
        .join(TaskAssignment, Task.id == TaskAssignment.task_id)
        .where(TaskAssignment.user_id == user.id)
        .options(selectinload(Task.creator))
    )

    if status:
        base = base.where(Task.status == status)
    else:
        base = base.where(
            Task.status.in_([
                TaskStatus.PENDING_ACCEPTANCE.value,
                TaskStatus.IN_PROGRESS.value,
                TaskStatus.UNDER_REVIEW.value,
            ])
        )

    if from_date:
        base = base.where(Task.due_date >= datetime.combine(from_date, datetime.min.time()))
    if to_date:
        base = base.where(Task.due_date <= datetime.combine(to_date, datetime.max.time()))

    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()

    rows = (await db.execute(base.order_by(Task.due_date.asc()).offset(skip).limit(limit))).all()
    items = []
    for row in rows:
        task_dict = TaskSummaryResponse.model_validate(row.Task).model_dump()
        task_dict["my_assignment_status"] = row.assignment_status
        items.append(TaskSummaryResponse(**task_dict))

    return PaginatedTaskResponse(items=items, total=total)
