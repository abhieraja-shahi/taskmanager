from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_manager
from app.models.task import Task
from app.models.user import User
from app.models.zammad_ticket import ZammadTicket
from app.schemas.task import TaskSummaryResponse

router = APIRouter(prefix="/zammad", tags=["zammad"])


class ZammadTicketResponse(BaseModel):
    id: int
    ticket_id: int
    number: str
    title: str
    state: str
    priority: Optional[str] = None
    group_name: Optional[str] = None
    owner_email: Optional[str] = None
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    article_from: Optional[str] = None
    article_body: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


@router.get("/tickets", response_model=List[ZammadTicketResponse])
async def list_zammad_tickets(
    state: Optional[str] = Query(None, description="Filter by ticket state"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    stmt = select(ZammadTicket).order_by(ZammadTicket.created_at.desc())
    if state:
        stmt = stmt.where(ZammadTicket.state == state)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/tickets/{ticket_id}/tasks", response_model=List[TaskSummaryResponse])
async def list_tasks_for_ticket(
    ticket_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    result = await db.execute(
        select(Task)
        .where(Task.zammad_ticket_id == ticket_id)
        .order_by(Task.created_at.desc())
    )
    return result.scalars().all()
