"""Add Person and AppSettings models

Revision ID: c7316ad41abf
Revises: c78196e6db41
Create Date: 2026-02-14 08:42:01.271217

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c7316ad41abf'
down_revision: Union[str, Sequence[str], None] = 'c78196e6db41'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema with data migration."""

    # 1. Create persons table
    op.create_table('persons',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_persons_id'), 'persons', ['id'], unique=False)
    op.create_index(op.f('ix_persons_name'), 'persons', ['name'], unique=True)

    # 2. Insert default persons
    op.execute("INSERT INTO persons (id, name) VALUES (1, 'COMUNE')")
    op.execute("INSERT INTO persons (id, name) VALUES (2, 'MARCO')")
    op.execute("INSERT INTO persons (id, name) VALUES (3, 'ANNA')")

    # 3. Add person_id columns as NULLABLE first
    op.add_column('transactions', sa.Column('person_id', sa.Integer(), nullable=True))
    op.add_column('large_advances', sa.Column('person_id', sa.Integer(), nullable=True))
    op.add_column('personal_advances', sa.Column('person_id', sa.Integer(), nullable=True))

    # 4. Migrate data from enum to person_id
    # Transactions
    op.execute("UPDATE transactions SET person_id = 1 WHERE payer = 'COMUNE'")
    op.execute("UPDATE transactions SET person_id = 2 WHERE payer = 'MARCO'")
    op.execute("UPDATE transactions SET person_id = 3 WHERE payer = 'ANNA'")

    # Large Advances
    op.execute("UPDATE large_advances SET person_id = 1 WHERE person = 'COMUNE'")
    op.execute("UPDATE large_advances SET person_id = 2 WHERE person = 'MARCO'")
    op.execute("UPDATE large_advances SET person_id = 3 WHERE person = 'ANNA'")

    # Personal Advances
    op.execute("UPDATE personal_advances SET person_id = 1 WHERE person = 'COMUNE'")
    op.execute("UPDATE personal_advances SET person_id = 2 WHERE person = 'MARCO'")
    op.execute("UPDATE personal_advances SET person_id = 3 WHERE person = 'ANNA'")

    # 5. Make person_id NOT NULL and add foreign keys
    # For SQLite we need to recreate tables to change nullable constraint
    # Using batch mode for SQLite compatibility
    with op.batch_alter_table('transactions') as batch_op:
        batch_op.alter_column('person_id', nullable=False)
        batch_op.create_foreign_key('fk_transactions_person', 'persons', ['person_id'], ['id'])
        batch_op.drop_column('payer')

    with op.batch_alter_table('large_advances') as batch_op:
        batch_op.alter_column('person_id', nullable=False)
        batch_op.create_foreign_key('fk_large_advances_person', 'persons', ['person_id'], ['id'])
        batch_op.drop_column('person')

    with op.batch_alter_table('personal_advances') as batch_op:
        batch_op.alter_column('person_id', nullable=False)
        batch_op.create_foreign_key('fk_personal_advances_person', 'persons', ['person_id'], ['id'])
        batch_op.drop_column('person')

    # 6. Create app_settings table and insert defaults
    op.create_table('app_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('monthly_income', sa.Float(), nullable=False),
        sa.Column('monthly_contribution_per_person', sa.Float(), nullable=False),
        sa.Column('smtp_server', sa.String(), nullable=True),
        sa.Column('smtp_port', sa.Integer(), nullable=True),
        sa.Column('smtp_username', sa.String(), nullable=True),
        sa.Column('smtp_password', sa.String(), nullable=True),
        sa.Column('smtp_use_tls', sa.Boolean(), nullable=True),
        sa.Column('email_recipients', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_app_settings_id'), 'app_settings', ['id'], unique=False)

    # Insert default settings
    op.execute("""
        INSERT INTO app_settings
        (id, monthly_income, monthly_contribution_per_person, smtp_server, smtp_port, smtp_use_tls)
        VALUES (1, 2100.0, 1050.0, 'smtp.gmail.com', 587, TRUE)
    """)


def downgrade() -> None:
    """Downgrade schema."""
    # Drop app_settings
    op.drop_index(op.f('ix_app_settings_id'), table_name='app_settings')
    op.drop_table('app_settings')

    # Restore old enum columns
    with op.batch_alter_table('transactions') as batch_op:
        batch_op.add_column(sa.Column('payer', sa.VARCHAR(length=6), nullable=True))

    with op.batch_alter_table('large_advances') as batch_op:
        batch_op.add_column(sa.Column('person', sa.VARCHAR(length=6), nullable=True))

    with op.batch_alter_table('personal_advances') as batch_op:
        batch_op.add_column(sa.Column('person', sa.VARCHAR(length=6), nullable=True))

    # Migrate data back
    op.execute("UPDATE transactions SET payer = (SELECT name FROM persons WHERE id = person_id)")
    op.execute("UPDATE large_advances SET person = (SELECT name FROM persons WHERE id = person_id)")
    op.execute("UPDATE personal_advances SET person = (SELECT name FROM persons WHERE id = person_id)")

    # Drop foreign keys and person_id columns
    with op.batch_alter_table('transactions') as batch_op:
        batch_op.drop_constraint('fk_transactions_person', type_='foreignkey')
        batch_op.drop_column('person_id')
        batch_op.alter_column('payer', nullable=False)

    with op.batch_alter_table('large_advances') as batch_op:
        batch_op.drop_constraint('fk_large_advances_person', type_='foreignkey')
        batch_op.drop_column('person_id')
        batch_op.alter_column('person', nullable=False)

    with op.batch_alter_table('personal_advances') as batch_op:
        batch_op.drop_constraint('fk_personal_advances_person', type_='foreignkey')
        batch_op.drop_column('person_id')
        batch_op.alter_column('person', nullable=False)

    # Drop persons table
    op.drop_index(op.f('ix_persons_name'), table_name='persons')
    op.drop_index(op.f('ix_persons_id'), table_name='persons')
    op.drop_table('persons')
