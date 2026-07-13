"""add_reviewed_by_to_tasks

Revision ID: a1c4f9e07b23
Revises: 839fff488cc5
Create Date: 2026-05-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1c4f9e07b23'
down_revision: Union[str, None] = '839fff488cc5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('tasks', sa.Column('reviewed_by', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_tasks_reviewed_by_users',
        'tasks', 'users',
        ['reviewed_by'], ['id']
    )


def downgrade() -> None:
    op.drop_constraint('fk_tasks_reviewed_by_users', 'tasks', type_='foreignkey')
    op.drop_column('tasks', 'reviewed_by')
