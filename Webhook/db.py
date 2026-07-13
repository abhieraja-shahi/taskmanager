import os
from datetime import datetime, timezone
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'task_manager', '.env'))

_engine = None
_Session = None


def _get_session():
    global _engine, _Session
    if _Session is None:
        url = os.environ["SYNC_DATABASE_URL"]
        _engine = create_engine(url, pool_pre_ping=True)
        _Session = sessionmaker(_engine)
    return _Session()


def _parse_dt(value: str | None):
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc).replace(tzinfo=None)


def upsert_ticket(ticket) -> None:
    """Insert or update a zammad_tickets row keyed on ticket_id."""
    sql = text("""
        INSERT INTO zammad_tickets
            (ticket_id, number, title, state, priority, group_name,
             owner_email, customer_name, customer_email, article_from, article_body,
             created_at, updated_at, synced_at)
        VALUES
            (:ticket_id, :number, :title, :state, :priority, :group_name,
             :owner_email, :customer_name, :customer_email, :article_from, :article_body,
             :created_at, :updated_at, NOW())
        ON DUPLICATE KEY UPDATE
            title        = VALUES(title),
            state        = VALUES(state),
            priority     = VALUES(priority),
            group_name   = VALUES(group_name),
            owner_email  = VALUES(owner_email),
            customer_name  = VALUES(customer_name),
            customer_email = VALUES(customer_email),
            article_from = COALESCE(VALUES(article_from), article_from),
            article_body = COALESCE(VALUES(article_body), article_body),
            updated_at   = VALUES(updated_at),
            synced_at    = NOW()
    """)

    params = {
        "ticket_id":     ticket.ticket_id,
        "number":        ticket.number,
        "title":         ticket.title,
        "state":         ticket.state or "",
        "priority":      ticket.priority,
        "group_name":    ticket.group,
        "owner_email":   ticket.owner_email,
        "customer_name": ticket.customer_name,
        "customer_email": ticket.customer_email,
        "article_from":  ticket.article.from_address if ticket.article else None,
        "article_body":  ticket.article.body if ticket.article else None,
        "created_at":    _parse_dt(ticket.created_at),
        "updated_at":    _parse_dt(ticket.updated_at),
    }

    with _get_session() as session:
        session.execute(sql, params)
        session.commit()
