import enum
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, BigInteger, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class ArtifactType(str, enum.Enum):
    WAR = "WAR"
    EAR = "EAR"


class SoftwareVersion(str, enum.Enum):
    EBANK = "eBank"
    BNKBIZ = "BnkBiz"
    OTHER = "Other"


deployment_banks = Table(
    "deployment_banks",
    Base.metadata,
    Column("deployment_id", Integer, ForeignKey("deployments.id", ondelete="CASCADE"), primary_key=True),
    Column("bank_id", Integer, ForeignKey("banks.id", ondelete="CASCADE"), primary_key=True),
)

deployment_tasks = Table(
    "deployment_tasks",
    Base.metadata,
    Column("deployment_id", Integer, ForeignKey("deployments.id", ondelete="CASCADE"), primary_key=True),
    Column("task_id", Integer, ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True),
)


class Deployment(Base):
    __tablename__ = "deployments"

    id = Column(Integer, primary_key=True)
    artifact_type = Column(String(10), nullable=False)
    software_version = Column(String(20), nullable=False)
    name = Column(String(255), nullable=False)
    purpose = Column(Text, nullable=False)
    script_filename = Column(String(255), nullable=True)
    script_filepath = Column(String(512), nullable=True)
    script_file_size = Column(BigInteger, nullable=True)
    script_content_type = Column(String(128), nullable=True)
    deployed_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    deployed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    deployed_by = relationship("User", foreign_keys=[deployed_by_id])
    banks = relationship("Bank", secondary="deployment_banks")
    tasks = relationship("Task", secondary="deployment_tasks")
