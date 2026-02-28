"""Add notes column to transactions

Revision ID: 9f3a6c1d4b2e
Revises: 77b8c9f1e2aa
Create Date: 2026-02-28 10:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9f3a6c1d4b2e'
down_revision: Union[str, Sequence[str], None] = '77b8c9f1e2aa'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('transactions') as batch_op:
        batch_op.add_column(sa.Column('notes', sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('transactions') as batch_op:
        batch_op.drop_column('notes')
