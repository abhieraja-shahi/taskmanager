"""add_zammad_ticket_id_to_tasks

Revision ID: b4d2e8f91a3c
Revises: 62745d622346
Create Date: 2026-05-28 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b4d2e8f91a3c'
down_revision: Union[str, None] = '62745d622346'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('tasks', sa.Column('zammad_ticket_id', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('tasks', 'zammad_ticket_id')
