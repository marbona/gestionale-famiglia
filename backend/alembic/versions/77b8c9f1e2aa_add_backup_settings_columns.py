"""Add backup scheduling fields to app_settings

Revision ID: 77b8c9f1e2aa
Revises: d2f4e8a1c5b3
Create Date: 2026-02-27 15:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '77b8c9f1e2aa'
down_revision: Union[str, Sequence[str], None] = 'd2f4e8a1c5b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('app_settings', sa.Column('backup_enabled', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('app_settings', sa.Column('backup_frequency_hours', sa.Integer(), nullable=False, server_default='24'))
    op.add_column('app_settings', sa.Column('backup_recipients', sa.Text(), nullable=True))
    op.add_column('app_settings', sa.Column('backup_last_sent_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('app_settings', 'backup_last_sent_at')
    op.drop_column('app_settings', 'backup_recipients')
    op.drop_column('app_settings', 'backup_frequency_hours')
    op.drop_column('app_settings', 'backup_enabled')
