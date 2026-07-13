from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_current_user, require_admin, require_manager
from app.models.team import Team, TeamMember, TeamManager
from app.models.user import User, UserRole
from app.schemas.team import TeamCreate, TeamManagerAdd, TeamMemberAdd, TeamResponse

router = APIRouter(prefix="/teams", tags=["teams"])


async def _load_team(db: AsyncSession, team_id: int) -> Team:
    result = await db.execute(
        select(Team)
        .options(
            selectinload(Team.members).selectinload(TeamMember.user),
            selectinload(Team.managers).selectinload(TeamManager.user),
        )
        .where(Team.id == team_id)
    )
    team = result.scalar_one_or_none()
    if team is None:
        raise HTTPException(status_code=404, detail="Team not found")
    return team


@router.post("/", response_model=TeamResponse, status_code=201)
async def create_team(
    data: TeamCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_manager),
):
    existing = await db.execute(select(Team).where(Team.name == data.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Team name already exists")

    team = Team(name=data.name, created_by=user.id)
    db.add(team)
    await db.flush()

    db.add(TeamManager(team_id=team.id, user_id=user.id))

    for uid in set(data.member_ids):
        db.add(TeamMember(team_id=team.id, user_id=uid))

    await db.commit()
    return await _load_team(db, team.id)


@router.get("/", response_model=List[TeamResponse])
async def list_teams(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Team)
        .options(
            selectinload(Team.members).selectinload(TeamMember.user),
            selectinload(Team.managers).selectinload(TeamManager.user),
        )
        .order_by(Team.name)
    )
    return result.scalars().all()


@router.get("/{team_id}", response_model=TeamResponse)
async def get_team(
    team_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await _load_team(db, team_id)


@router.post("/{team_id}/managers", response_model=TeamResponse)
async def add_managers(
    team_id: int,
    data: TeamManagerAdd,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    team = await db.get(Team, team_id)
    if team is None:
        raise HTTPException(status_code=404, detail="Team not found")

    existing_result = await db.execute(
        select(TeamManager.user_id).where(TeamManager.team_id == team_id)
    )
    existing_ids = {row[0] for row in existing_result}

    for uid in set(data.user_ids):
        if uid in existing_ids:
            continue
        user = await db.get(User, uid)
        if not user:
            raise HTTPException(status_code=404, detail=f"User {uid} not found")
        if user.role not in (UserRole.MANAGER.value, UserRole.ADMIN.value):
            raise HTTPException(status_code=400, detail=f"User {user.username} must be a manager or admin")
        db.add(TeamManager(team_id=team_id, user_id=uid))

    await db.commit()
    return await _load_team(db, team_id)


@router.delete("/{team_id}/managers/{user_id}", status_code=204)
async def remove_manager(
    team_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(
        select(TeamManager).where(
            TeamManager.team_id == team_id,
            TeamManager.user_id == user_id,
        )
    )
    tm = result.scalar_one_or_none()
    if tm is None:
        raise HTTPException(status_code=404, detail="Manager not found in team")
    await db.delete(tm)
    await db.commit()


@router.post("/{team_id}/members", response_model=TeamResponse)
async def add_members(
    team_id: int,
    data: TeamMemberAdd,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_manager),
):
    team = await db.get(Team, team_id)
    if team is None:
        raise HTTPException(status_code=404, detail="Team not found")

    existing_result = await db.execute(
        select(TeamMember.user_id).where(TeamMember.team_id == team_id)
    )
    existing_ids = {row[0] for row in existing_result}

    for uid in set(data.user_ids):
        if uid not in existing_ids:
            db.add(TeamMember(team_id=team_id, user_id=uid))

    await db.commit()
    return await _load_team(db, team_id)


@router.delete("/{team_id}", status_code=204)
async def delete_team(
    team_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    team = await db.get(Team, team_id)
    if team is None:
        raise HTTPException(status_code=404, detail="Team not found")
    await db.delete(team)
    await db.commit()


@router.delete("/{team_id}/members/{user_id}", status_code=204)
async def remove_member(
    team_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_manager),
):
    result = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team_id,
            TeamMember.user_id == user_id,
        )
    )
    member = result.scalar_one_or_none()
    if member is None:
        raise HTTPException(status_code=404, detail="Member not found in team")
    await db.delete(member)
    await db.commit()
