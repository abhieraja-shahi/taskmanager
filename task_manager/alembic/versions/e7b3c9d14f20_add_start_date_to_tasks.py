"""add start_date to tasks

Revision ID: e7b3c9d14f20
Revises: c3a8b9e45f12
Create Date: 2026-04-15 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e7b3c9d14f20'
down_revision: Union[str, None] = 'c3a8b9e45f12'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('tasks', sa.Column('start_date', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('tasks', 'start_date')
