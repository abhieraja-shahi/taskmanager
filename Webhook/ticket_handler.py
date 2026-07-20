import os
import re
import logging
import requests
from ticket_parser import parse_ticket, Ticket, Article
from db import upsert_ticket

logger = logging.getLogger(__name__)

# Only persist tickets belonging to this Zammad group.
# Change this to match the exact group name in your Zammad instance.
DEV_GROUP = "Development"


def _fetch_first_article(ticket_id: int) -> Article | None:
    """Fetch the first customer-visible article for a ticket from Zammad API."""
    base_url = os.environ.get("ZAMMAD_BASE_URL", "").rstrip("/")
    api_token = os.environ.get("ZAMMAD_API_TOKEN", "")
    if not base_url or not api_token:
        return None

    try:
        resp = requests.get(
            f"{base_url}/api/v1/ticket_articles/by_ticket/{ticket_id}",
            headers={"Authorization": f"Token token={api_token}"},
            timeout=8,
            verify=False,
        )
        resp.raise_for_status()
        articles = resp.json()
    except Exception as exc:
        logger.warning("Could not fetch articles for ticket %d from Zammad: %s", ticket_id, exc)
        return None

    if not isinstance(articles, list) or not articles:
        return None

    # Prefer the first non-internal article sent by a Customer
    preferred = next(
        (a for a in articles if a.get("sender") == "Customer" and not a.get("internal")),
        articles[0],
    )

    body_raw = preferred.get("body", "") or ""
    body_clean = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", body_raw)).strip()

    return Article(
        article_id=preferred.get("id"),
        subject=preferred.get("subject"),
        body=body_clean,
        body_raw=body_raw,
        content_type=preferred.get("content_type"),
        sender=preferred.get("sender"),
        from_address=preferred.get("from"),
        to_address=preferred.get("to"),
        cc=preferred.get("cc"),
        article_type=preferred.get("type"),
        created_at=preferred.get("created_at"),
        attachments=[],
    )


def handle_ticket_created(payload: dict) -> None:
    try:
        ticket = parse_ticket(payload)
    except Exception as exc:
        logger.error("Failed to parse ticket payload: %s", exc, exc_info=True)
        return

    # If the webhook payload didn't include article data, fetch it from Zammad API.
    if ticket.article is None:
        ticket.article = _fetch_first_article(ticket.ticket_id)
        if ticket.article:
            logger.info("Ticket #%s: fetched article from Zammad API", ticket.number)
        else:
            logger.info("Ticket #%s: no article available", ticket.number)

    _log_ticket(ticket)

    if ticket.group != DEV_GROUP:
        logger.info("Ticket #%s is in group '%s' — skipping persist", ticket.number, ticket.group)
        return

    try:
        upsert_ticket(ticket)
        logger.info("Ticket #%s upserted to DB", ticket.number)
    except Exception as exc:
        logger.error("Failed to upsert ticket #%s: %s", ticket.number, exc, exc_info=True)


def _log_ticket(ticket: Ticket) -> None:
    sep = "─" * 56

    logger.info(sep)
    logger.info("🎫  NEW TICKET — #%s  (id: %d)", ticket.number, ticket.ticket_id)
    logger.info(sep)
    logger.info("  Title            : %s", ticket.title)
    logger.info("  State            : %s", ticket.state)
    logger.info("  Priority         : %s", ticket.priority)
    logger.info("  Group            : %s", ticket.group)
    logger.info("  Channel          : %s", ticket.create_article_type or "—")
    logger.info("  Tags             : %s", ", ".join(ticket.tags) if ticket.tags else "—")
    logger.info("  Created          : %s", ticket.created_at)

    logger.info("  ── Customer ──")
    logger.info("  Name             : %s", ticket.customer_name or "—")
    logger.info("  Email            : %s", ticket.customer_email or "—")
    logger.info("  ID               : %s", ticket.customer_id or "—")

    if ticket.organization_name:
        logger.info("  ── Organization ──")
        logger.info("  Name             : %s", ticket.organization_name)
        logger.info("  ID               : %s", ticket.organization_id)

    logger.info("  ── Owner ──")
    logger.info("  Email            : %s", ticket.owner_email or "unassigned")

    if ticket.article:
        art = ticket.article
        logger.info("  ── Article ──")
        logger.info("  Subject          : %s", art.subject or "—")
        logger.info("  From             : %s", art.from_address or "—")
        logger.info("  To               : %s", art.to_address or "—")
        logger.info("  Type             : %s", art.article_type or "—")
        if art.cc:
            logger.info("  CC               : %s", art.cc)

        body_preview = (art.body or "").strip()[:300]
        if body_preview:
            logger.info("  Body ↓")
            for line in body_preview.splitlines():
                if line.strip():
                    logger.info("    %s", line)
            if art.body and len(art.body) > 300:
                logger.info("    … (%d chars total)", len(art.body))

        if art.attachments:
            logger.info("  ── Attachments (%d) ──", len(art.attachments))
            for att in art.attachments:
                logger.info("    • %s (%s, %s bytes)", att.filename, att.mime_type, att.size)
                logger.info("      %s", att.url)

    logger.info(sep)
