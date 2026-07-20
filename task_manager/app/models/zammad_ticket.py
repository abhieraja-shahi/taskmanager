from sqlalchemy import Column, Integer, String, Text, DateTime, UniqueConstraint
from sqlalchemy.sql import func
from app.database import Base


class ZammadTicket(Base):
    __tablename__ = "zammad_tickets"

    id = Column(Integer, primary_key=True)
    ticket_id = Column(Integer, nullable=False, unique=True)
    number = Column(String(50), nullable=False)
    title = Column(String(500), nullable=False)
    state = Column(String(100), nullable=False)
    priority = Column(String(100), nullable=True)
    group_name = Column(String(255), nullable=True)
    owner_email = Column(String(255), nullable=True)
    customer_name = Column(String(255), nullable=True)
    customer_email = Column(String(255), nullable=True)
    article_from = Column(String(255), nullable=True)
    article_body = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=True)
    synced_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    resolved_by_id = Column(Integer, nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
