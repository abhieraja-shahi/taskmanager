"""multi_manager_teams

Revision ID: d5f1a2e83b47
Revises: b4d2e8f91a3c
Create Date: 2026-05-29 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd5f1a2e83b47'
down_revision: Union[str, None] = 'b4d2e8f91a3c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create team_managers junction table
    op.create_table(
        'team_managers',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('team_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['team_id'], ['teams.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('team_id', 'user_id', name='uq_team_manager'),
    )

    # Migrate existing manager_id data into the new table
    op.execute(
        """
        INSERT INTO team_managers (team_id, user_id)
        SELECT id, manager_id FROM teams WHERE manager_id IS NOT NULL
        """
    )

    # Drop the old manager_id column
    op.drop_constraint('fk_teams_manager_id_users', 'teams', type_='foreignkey')
    op.drop_column('teams', 'manager_id')


def downgrade() -> None:
    # Restore manager_id column
    op.add_column('teams', sa.Column('manager_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_teams_manager_id_users',
        'teams', 'users',
        ['manager_id'], ['id'],
        ondelete='SET NULL',
    )

    # Restore one manager per team (pick the lowest user_id if multiple)
    op.execute(
        """
        UPDATE teams t
        JOIN (
            SELECT team_id, MIN(user_id) AS user_id
            FROM team_managers
            GROUP BY team_id
        ) m ON t.id = m.team_id
        SET t.manager_id = m.user_id
        """
    )

    op.drop_table('team_managers')
