"""Add monthly account balance table

Revision ID: c5e8f2a3b1d4
Revises: b4a7d9e2c1f0
Create Date: 2026-04-09 17:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c5e8f2a3b1d4'
down_revision: Union[str, Sequence[str], None] = 'b4a7d9e2c1f0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'monthly_account_balances',
        sa.Column('id', sa.Integer(), primary_key=True, nullable=False),
        sa.Column('year', sa.Integer(), nullable=False),
        sa.Column('month', sa.Integer(), nullable=False),
        sa.Column('account_balance', sa.Float(), nullable=True),
        sa.UniqueConstraint('year', 'month', name='uq_monthly_account_balances_year_month'),
    )
    op.create_index(op.f('ix_monthly_account_balances_id'), 'monthly_account_balances', ['id'], unique=False)
    op.create_index(op.f('ix_monthly_account_balances_year'), 'monthly_account_balances', ['year'], unique=False)
    op.create_index(op.f('ix_monthly_account_balances_month'), 'monthly_account_balances', ['month'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_monthly_account_balances_month'), table_name='monthly_account_balances')
    op.drop_index(op.f('ix_monthly_account_balances_year'), table_name='monthly_account_balances')
    op.drop_index(op.f('ix_monthly_account_balances_id'), table_name='monthly_account_balances')
    op.drop_table('monthly_account_balances')
