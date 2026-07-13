import enum
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class TaskStatus(str, enum.Enum):
    PENDING_ACCEPTANCE = "pending_acceptance"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    REJECTED = "rejected"


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    due_date = Column(DateTime(timezone=True), nullable=False)
    start_date = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(50), default=TaskStatus.PENDING_ACCEPTANCE.value, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    zammad_ticket_id = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    assignments = relationship("TaskAssignment", back_populates="task", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="task", cascade="all, delete-orphan")
    activity_logs = relationship("ActivityLog", back_populates="task", cascade="all, delete-orphan")
    creator = relationship("User", foreign_keys=[created_by])
    reviewer = relationship("User", foreign_keys=[reviewed_by])
    banks = relationship("Bank", secondary="task_banks", back_populates="tasks")
    attachments = relationship("TaskAttachment", back_populates="task", cascade="all, delete-orphan")
