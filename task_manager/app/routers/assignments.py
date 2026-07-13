from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_current_user, require_manager
from app.models.task_assignment import TaskAssignment
from app.models.team import Team, TeamMember, TeamManager
from app.models.user import User, UserRole
from app.schemas.task import AssignmentResponse, AssignmentWithTaskResponse

router = APIRouter(prefix="/assignments", tags=["assignments"])


@router.get("/my", response_model=List[AssignmentResponse])
async def my_assignments(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return all task assignments for the authenticated user."""
    result = await db.execute(
        select(TaskAssignment)
        .options(selectinload(TaskAssignment.user))
        .where(TaskAssignment.user_id == user.id)
        .order_by(TaskAssignment.id.desc())
    )
    return result.scalars().all()


@router.get("/all", response_model=List[AssignmentWithTaskResponse])
async def all_assignments(
    db: AsyncSession = Depends(get_db),
    manager: User = Depends(require_manager),
):
    """Return all task assignments with user and task info (manager/admin only)."""
    query = (
        select(TaskAssignment)
        .options(
            selectinload(TaskAssignment.user),
            selectinload(TaskAssignment.task),
        )
        .order_by(TaskAssignment.user_id, TaskAssignment.task_id)
    )

    # Managers only see assignments for members of their teams
    if manager.role != UserRole.ADMIN.value:
        managed_user_ids = (
            select(TeamMember.user_id)
            .join(TeamManager, TeamMember.team_id == TeamManager.team_id)
            .where(TeamManager.user_id == manager.id)
        )
        query = query.where(TaskAssignment.user_id.in_(managed_user_ids))

    result = await db.execute(query)
    return result.scalars().all()
