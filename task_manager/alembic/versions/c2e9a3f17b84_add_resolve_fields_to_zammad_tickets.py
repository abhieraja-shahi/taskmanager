"""add resolve fields to zammad tickets

Revision ID: c2e9a3f17b84
Revises: 089ac712428d
Create Date: 2026-07-20 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c2e9a3f17b84'
down_revision: Union[str, None] = '089ac712428d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('zammad_tickets', sa.Column('resolved_by_id', sa.Integer(), nullable=True))
    op.add_column('zammad_tickets', sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('zammad_tickets', 'resolved_at')
    op.drop_column('zammad_tickets', 'resolved_by_id')
