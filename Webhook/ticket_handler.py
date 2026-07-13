import logging
from ticket_parser import parse_ticket, Ticket
from db import upsert_ticket

logger = logging.getLogger(__name__)

# Only persist tickets belonging to this Zammad group.
# Change this to match the exact group name in your Zammad instance.
DEV_GROUP = "Development"


def handle_ticket_created(payload: dict) -> None:
    try:
        ticket = parse_ticket(payload)
    except Exception as exc:
        logger.error("Failed to parse ticket payload: %s", exc, exc_info=True)
        return

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
