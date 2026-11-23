"""change avatar_url to text

Revision ID: 004_avatar_url_text
Revises: 003_add_contact_requests
Create Date: 2026-11-23

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '004_avatar_url_text'
down_revision = '003_add_contact_requests'
branch_labels = None
depends_on = None

def upgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.alter_column('avatar_url',
               existing_type=sa.String(length=512),
               type_=sa.Text(),
               existing_nullable=True)

def downgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.alter_column('avatar_url',
               existing_type=sa.Text(),
               type_=sa.String(length=512),
               existing_nullable=True)
