"""add push subscriptions

Revision ID: 002_add_push_subscriptions
Revises: 001_initial_schema
Create Date: 2026-11-23

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '002_add_push_subscriptions'
down_revision = '001_initial_schema'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        'push_subscriptions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('endpoint', sa.Text(), nullable=False),
        sa.Column('p256dh', sa.String(length=255), nullable=False),
        sa.Column('auth', sa.String(length=255), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('endpoint')
    )
    with op.batch_alter_table('push_subscriptions', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_push_subscriptions_user_id'), ['user_id'], unique=False)

def downgrade():
    with op.batch_alter_table('push_subscriptions', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_push_subscriptions_user_id'))
    op.drop_table('push_subscriptions')
