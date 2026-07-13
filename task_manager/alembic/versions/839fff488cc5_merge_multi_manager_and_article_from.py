"""merge_multi_manager_and_article_from

Revision ID: 839fff488cc5
Revises: d5f1a2e83b47, f3a1c7e02d85
Create Date: 2026-05-29 12:19:54.918986

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '839fff488cc5'
down_revision: Union[str, None] = ('d5f1a2e83b47', 'f3a1c7e02d85')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
