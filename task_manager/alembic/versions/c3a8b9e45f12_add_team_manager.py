"""add manager_id to teams

Revision ID: c3a8b9e45f12
Revises: af64a7945408
Create Date: 2026-04-15 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c3a8b9e45f12'
down_revision: Union[str, None] = 'af64a7945408'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('teams', sa.Column('manager_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_teams_manager_id_users',
        'teams', 'users',
        ['manager_id'], ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint('fk_teams_manager_id_users', 'teams', type_='foreignkey')
    op.drop_column('teams', 'manager_id')
