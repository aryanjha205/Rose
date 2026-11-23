"""add contact requests

Revision ID: 003_add_contact_requests
Revises: 002_add_push_subscriptions
Create Date: 2026-11-23

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '003_add_contact_requests'
down_revision = '002_add_push_subscriptions'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        'contact_requests',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('sender_id', sa.Integer(), nullable=False),
        sa.Column('receiver_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['receiver_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['sender_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('sender_id', 'receiver_id', name='uq_sender_receiver_request')
    )
    with op.batch_alter_table('contact_requests', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_contact_requests_sender_id'), ['sender_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_contact_requests_receiver_id'), ['receiver_id'], unique=False)

def downgrade():
    with op.batch_alter_table('contact_requests', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_contact_requests_receiver_id'))
        batch_op.drop_index(batch_op.f('ix_contact_requests_sender_id'))
    op.drop_table('contact_requests')
