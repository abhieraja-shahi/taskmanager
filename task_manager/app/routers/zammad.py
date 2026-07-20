from datetime import datetime, timezone
from typing import List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
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
    resolved_by_id: Optional[int] = None
    resolved_at: Optional[datetime] = None

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


@router.patch("/tickets/{ticket_id}/resolve", response_model=ZammadTicketResponse)
async def resolve_zammad_ticket(
    ticket_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    result = await db.execute(
        select(ZammadTicket).where(ZammadTicket.ticket_id == ticket_id)
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if not settings.ZAMMAD_BASE_URL or not settings.ZAMMAD_API_TOKEN:
        raise HTTPException(status_code=503, detail="Zammad integration not configured")

    async with httpx.AsyncClient(follow_redirects=True, verify=False) as client:
        response = await client.put(
            f"{settings.ZAMMAD_BASE_URL}/api/v1/tickets/{ticket_id}",
            json={"state": "Closed"},
            headers={"Authorization": f"Token token={settings.ZAMMAD_API_TOKEN}"},
            timeout=10.0,
        )

    if response.status_code not in (200, 201):
        raise HTTPException(
            status_code=502,
            detail=f"Zammad API error: {response.status_code} {response.text[:200]}",
        )

    ticket.state = "Closed"
    ticket.resolved_by_id = current_user.id
    ticket.resolved_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(ticket)
    return ticket
