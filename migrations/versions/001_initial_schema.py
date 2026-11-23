"""initial schema

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-11-23

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '001_initial_schema'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('username', sa.String(length=32), nullable=False),
        sa.Column('email', sa.String(length=120), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('display_name', sa.String(length=64), nullable=False),
        sa.Column('avatar_url', sa.String(length=512), nullable=True),
        sa.Column('bio', sa.String(length=255), nullable=True),
        sa.Column('is_online', sa.Boolean(), nullable=True),
        sa.Column('last_seen', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_users_email'), ['email'], unique=True)
        batch_op.create_index(batch_op.f('ix_users_username'), ['username'], unique=True)

    op.create_table(
        'contacts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('contact_user_id', sa.Integer(), nullable=False),
        sa.Column('nickname', sa.String(length=64), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['contact_user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'contact_user_id', name='uq_user_contact')
    )
    with op.batch_alter_table('contacts', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_contacts_contact_user_id'), ['contact_user_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_contacts_user_id'), ['user_id'], unique=False)

    op.create_table(
        'call_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('caller_id', sa.Integer(), nullable=False),
        sa.Column('receiver_id', sa.Integer(), nullable=False),
        sa.Column('call_type', sa.String(length=16), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('duration_seconds', sa.Integer(), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('ended_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['caller_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['receiver_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('call_logs', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_call_logs_caller_id'), ['caller_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_call_logs_receiver_id'), ['receiver_id'], unique=False)

def downgrade():
    op.drop_table('call_logs')
    op.drop_table('contacts')
    op.drop_table('users')
