import re
from datetime import datetime, timezone
from typing import List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import require_manager
from app.models.task import Task
from app.models.user import User
from app.models.zammad_ticket import ZammadTicket
from app.schemas.task import TaskSummaryResponse

router = APIRouter(prefix="/zammad", tags=["zammad"])


class ZammadArticleResponse(BaseModel):
    id: int
    from_address: Optional[str] = None
    body: Optional[str] = None
    sender: Optional[str] = None
    created_at: Optional[str] = None
    internal: bool = False


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


@router.get("/tickets/{ticket_id}/articles", response_model=List[ZammadArticleResponse])
async def get_ticket_articles(
    ticket_id: int,
    _: User = Depends(require_manager),
):
    """Fetch all articles for a ticket directly from Zammad."""
    if not settings.ZAMMAD_BASE_URL or not settings.ZAMMAD_API_TOKEN:
        raise HTTPException(status_code=503, detail="Zammad integration not configured")

    async with httpx.AsyncClient(follow_redirects=True, verify=False) as client:
        resp = await client.get(
            f"{settings.ZAMMAD_BASE_URL}/api/v1/ticket_articles/by_ticket/{ticket_id}",
            headers={"Authorization": f"Token token={settings.ZAMMAD_API_TOKEN}"},
            timeout=8.0,
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Zammad API error: {resp.status_code}")

    articles = resp.json()
    if not isinstance(articles, list):
        return []

    return [
        ZammadArticleResponse(
            id=a.get("id", 0),
            from_address=a.get("from"),
            body=_strip_html(a.get("body") or "") or None,
            sender=a.get("sender"),
            created_at=a.get("created_at"),
            internal=bool(a.get("internal", False)),
        )
        for a in articles
    ]


class NoteRequest(BaseModel):
    body: str


@router.post("/tickets/{ticket_id}/notes", status_code=201)
async def post_ticket_note(
    ticket_id: int,
    payload: NoteRequest,
    current_user: User = Depends(require_manager),
):
    """Post an internal note to a Zammad ticket."""
    if not settings.ZAMMAD_BASE_URL or not settings.ZAMMAD_API_TOKEN:
        raise HTTPException(status_code=503, detail="Zammad integration not configured")

    if not payload.body.strip():
        raise HTTPException(status_code=422, detail="Note body cannot be empty")

    async with httpx.AsyncClient(follow_redirects=True, verify=False) as client:
        resp = await client.post(
            f"{settings.ZAMMAD_BASE_URL}/api/v1/ticket_articles",
            json={
                "ticket_id": ticket_id,
                "body": payload.body.strip(),
                "type": "note",
                "internal": True,
                "content_type": "text/plain",
            },
            headers={"Authorization": f"Token token={settings.ZAMMAD_API_TOKEN}"},
            timeout=10.0,
        )

    if resp.status_code not in (200, 201):
        raise HTTPException(
            status_code=502,
            detail=f"Zammad API error: {resp.status_code} {resp.text[:200]}",
        )

    article = resp.json()
    return ZammadArticleResponse(
        id=article.get("id", 0),
        from_address=article.get("from"),
        body=_strip_html(article.get("body") or "") or None,
        sender=article.get("sender"),
        created_at=article.get("created_at"),
        internal=bool(article.get("internal", True)),
    )


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


def _strip_html(text: str) -> str:
    # Remove BOM and 4-byte chars that MySQL utf8 (3-byte) can't store
    text = text.replace('\ufeff', '')
    text = re.sub(r'[\U00010000-\U0010ffff]', '', text)
    clean = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", clean).strip()


async def _fetch_article_for_ticket(client: httpx.AsyncClient, zammad_ticket_id: int):
    """Return (from_address, body) from the first customer article, or (None, None)."""
    try:
        resp = await client.get(
            f"{settings.ZAMMAD_BASE_URL}/api/v1/ticket_articles/by_ticket/{zammad_ticket_id}",
            headers={"Authorization": f"Token token={settings.ZAMMAD_API_TOKEN}"},
            timeout=8.0,
        )
        resp.raise_for_status()
        articles = resp.json()
    except Exception:
        return None, None

    if not isinstance(articles, list) or not articles:
        return None, None

    preferred = next(
        (a for a in articles if a.get("sender") == "Customer" and not a.get("internal")),
        articles[0],
    )
    body_raw = preferred.get("body") or ""
    return preferred.get("from"), _strip_html(body_raw) or None


@router.post("/tickets/sync-articles", response_model=dict)
async def sync_ticket_articles(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_manager),
):
    """Fetch and backfill article_from / article_body for tickets that are missing them."""
    if not settings.ZAMMAD_BASE_URL or not settings.ZAMMAD_API_TOKEN:
        raise HTTPException(status_code=503, detail="Zammad integration not configured")

    result = await db.execute(
        select(ZammadTicket).where(
            (ZammadTicket.article_body == None) | (ZammadTicket.article_from == None)  # noqa: E711
        )
    )
    tickets = result.scalars().all()

    updated = 0
    async with httpx.AsyncClient(follow_redirects=True, verify=False) as client:
        for t in tickets:
            from_addr, body = await _fetch_article_for_ticket(client, t.ticket_id)
            if from_addr or body:
                if t.article_from is None:
                    t.article_from = from_addr
                if t.article_body is None:
                    t.article_body = body
                updated += 1

    await db.commit()
    return {"synced": len(tickets), "updated": updated}
