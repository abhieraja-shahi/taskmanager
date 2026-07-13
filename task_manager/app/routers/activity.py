from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import require_manager
from app.models.activity_log import ActivityLog
from app.models.task import Task
from app.models.task_assignment import TaskAssignment
from app.models.team import Team, TeamMember, TeamManager
from app.models.user import User, UserRole
from app.schemas.task import ActivityLogDetailResponse

router = APIRouter(prefix="/activity", tags=["activity"])


@router.get("/", response_model=List[ActivityLogDetailResponse])
async def get_activity_logs(
    from_date: Optional[date] = Query(None, description="Logs on or after this date"),
    to_date: Optional[date] = Query(None, description="Logs on or before this date"),
    user_id: Optional[int] = Query(None, description="Filter by user who performed the action"),
    team_id: Optional[int] = Query(None, description="Filter by team (tasks assigned to team members)"),
    action: Optional[str] = Query(None, description="Filter by action type"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    query = select(ActivityLog).options(
        selectinload(ActivityLog.task),
        selectinload(ActivityLog.user),
    )

    # Managers see only activity for tasks in their teams; admins see all
    if current_user.role != UserRole.ADMIN.value:
        managed_task_ids = (
            select(TaskAssignment.task_id)
            .join(TeamMember, TaskAssignment.user_id == TeamMember.user_id)
            .join(Team, TeamMember.team_id == Team.id)
            .join(TeamManager, Team.id == TeamManager.team_id)
            .where(TeamManager.user_id == current_user.id)
        )
        query = query.where(ActivityLog.task_id.in_(managed_task_ids))

    if from_date:
        query = query.where(
            ActivityLog.timestamp >= datetime.combine(from_date, datetime.min.time())
        )
    if to_date:
        query = query.where(
            ActivityLog.timestamp <= datetime.combine(to_date, datetime.max.time())
        )
    if user_id:
        query = query.where(ActivityLog.user_id == user_id)
    if action:
        query = query.where(ActivityLog.action == action.upper())
    if team_id:
        team_task_ids = (
            select(TaskAssignment.task_id)
            .join(TeamMember, TaskAssignment.user_id == TeamMember.user_id)
            .where(TeamMember.team_id == team_id)
        )
        query = query.where(ActivityLog.task_id.in_(team_task_ids))

    query = query.order_by(ActivityLog.timestamp.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()
