from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Attachment:
    attachment_id: int
    filename: str
    size: str
    mime_type: str
    url: str


@dataclass
class Article:
    article_id: Optional[int]
    subject: Optional[str]
    body: Optional[str]
    body_raw: Optional[str]          # original HTML
    content_type: Optional[str]
    sender: Optional[str]
    from_address: Optional[str]
    to_address: Optional[str]
    cc: Optional[str]
    article_type: Optional[str]
    created_at: Optional[str]
    attachments: list = field(default_factory=list)


@dataclass
class Ticket:
    ticket_id: int
    number: str
    title: str
    state: str
    priority: str
    group: str

    customer_id: Optional[int]
    customer_email: Optional[str]
    customer_name: Optional[str]

    organization_id: Optional[int]
    organization_name: Optional[str]

    owner_id: Optional[int]
    owner_email: Optional[str]

    create_article_type: Optional[str]
    created_at: Optional[str]
    updated_at: Optional[str]

    tags: list = field(default_factory=list)
    article: Optional[Article] = None
    raw: dict = field(default_factory=dict)


def parse_ticket(payload: dict) -> Ticket:
    t = payload.get("ticket", {})
    a = payload.get("article", {})

    # Parse attachments
    attachments = []
    for att in a.get("attachments", []):
        prefs = att.get("preferences", {})
        mime = prefs.get("Mime-Type") or prefs.get("Content-Type", "")
        attachments.append(Attachment(
            attachment_id=att.get("id"),
            filename=att.get("filename", ""),
            size=att.get("size", ""),
            mime_type=mime,
            url=att.get("url", ""),
        ))

    article = None
    if a:
        body_raw = a.get("body", "")
        article = Article(
            article_id=a.get("id"),
            subject=a.get("subject"),
            body=_strip_html(body_raw),
            body_raw=body_raw,
            content_type=a.get("content_type"),
            sender=a.get("sender"),
            from_address=a.get("from"),
            to_address=a.get("to"),
            cc=a.get("cc"),
            article_type=a.get("type"),
            created_at=a.get("created_at"),
            attachments=attachments,
        )

    customer     = t.get("customer") or {}
    owner        = t.get("owner") or {}
    group        = t.get("group") or {}
    priority     = t.get("priority") or {}
    organization = t.get("organization") or {}

    return Ticket(
        ticket_id=t.get("id", 0),
        number=str(t.get("number", "")),
        title=t.get("title", "(no title)"),
        state=t.get("state") if isinstance(t.get("state"), str) else _nested(t, "state", "name"),
        priority=priority.get("name") if isinstance(priority, dict) else str(priority),
        group=group.get("name") if isinstance(group, dict) else str(group),

        customer_id=t.get("customer_id") or customer.get("id"),
        customer_email=customer.get("email"),
        customer_name=_full_name(customer),

        organization_id=t.get("organization_id"),
        organization_name=organization.get("name"),

        owner_id=t.get("owner_id"),
        owner_email=owner.get("email") or None,

        create_article_type=t.get("create_article_type"),
        created_at=t.get("created_at"),
        updated_at=t.get("updated_at"),

        tags=t.get("tags", []),
        article=article,
        raw=payload,
    )


# ── helpers ───────────────────────────────────────────────────────────────────

def _nested(d: dict, key: str, subkey: str) -> str:
    val = d.get(key)
    if isinstance(val, dict):
        return val.get(subkey, "")
    return val or ""


def _full_name(person: dict) -> Optional[str]:
    first = (person.get("firstname") or "").strip()
    last  = (person.get("lastname") or "").strip()
    name  = f"{first} {last}".strip()
    return name or None


def _strip_html(text: str) -> str:
    import re
    clean = re.sub(r"<[^>]+>", " ", text)
    clean = re.sub(r"\s+", " ", clean).strip()
    return clean
