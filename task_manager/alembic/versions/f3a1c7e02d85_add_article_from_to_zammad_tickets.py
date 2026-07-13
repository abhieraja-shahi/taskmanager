"""add_article_from_to_zammad_tickets

Revision ID: f3a1c7e02d85
Revises: b4d2e8f91a3c
Create Date: 2026-05-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f3a1c7e02d85'
down_revision: Union[str, None] = 'b4d2e8f91a3c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('zammad_tickets', sa.Column('article_from', sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column('zammad_tickets', 'article_from')
