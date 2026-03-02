"""Add monthly income overrides table

Revision ID: b4a7d9e2c1f0
Revises: 9f3a6c1d4b2e
Create Date: 2026-03-02 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b4a7d9e2c1f0'
down_revision: Union[str, Sequence[str], None] = '9f3a6c1d4b2e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'monthly_income_overrides',
        sa.Column('id', sa.Integer(), primary_key=True, nullable=False),
        sa.Column('year', sa.Integer(), nullable=False),
        sa.Column('month', sa.Integer(), nullable=False),
        sa.Column('total_income', sa.Float(), nullable=False),
        sa.UniqueConstraint('year', 'month', name='uq_monthly_income_overrides_year_month'),
    )
    op.create_index(op.f('ix_monthly_income_overrides_id'), 'monthly_income_overrides', ['id'], unique=False)
    op.create_index(op.f('ix_monthly_income_overrides_year'), 'monthly_income_overrides', ['year'], unique=False)
    op.create_index(op.f('ix_monthly_income_overrides_month'), 'monthly_income_overrides', ['month'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_monthly_income_overrides_month'), table_name='monthly_income_overrides')
    op.drop_index(op.f('ix_monthly_income_overrides_year'), table_name='monthly_income_overrides')
    op.drop_index(op.f('ix_monthly_income_overrides_id'), table_name='monthly_income_overrides')
    op.drop_table('monthly_income_overrides')
