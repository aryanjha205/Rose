"""
WebCall Database Seed Script
Populates demo users for immediate testing.
"""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app import create_app
from backend.database import db
from backend.models.user import User
from backend.models.contact import Contact
from backend.models.call_log import CallLog
from datetime import datetime, timezone, timedelta

def seed_database():
    app = create_app()
    with app.app_context():
        # Check if users already exist
        if User.query.filter_by(username="sarah").first():
            print("Database already seeded.")
            return

        print("Seeding database with demo users...")
        sarah = User(
            username="sarah",
            email="sarah@webcall.com",
            display_name="Sarah Connor",
            avatar_url="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=240&h=240&fit=crop&crop=faces",
            bio="Designer & WebCall enthusiast 🌸"
        )
        sarah.set_password("password123")

        alex = User(
            username="alex",
            email="alex@webcall.com",
            display_name="Alex Rivera",
            avatar_url="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=240&h=240&fit=crop&crop=faces",
            bio="Software engineer & coffee lover ☕"
        )
        alex.set_password("password123")

        emma = User(
            username="emma",
            email="emma@webcall.com",
            display_name="Emma Watson",
            avatar_url="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=240&h=240&fit=crop&crop=faces",
            bio="Always down for a quick video chat! ✨"
        )
        emma.set_password("password123")

        db.session.add_all([sarah, alex, emma])
        db.session.commit()

        # Add contacts
        contact1 = Contact(user_id=sarah.id, contact_user_id=alex.id, nickname="Alex Rivera")
        contact2 = Contact(user_id=sarah.id, contact_user_id=emma.id, nickname="Emma Watson")
        contact3 = Contact(user_id=alex.id, contact_user_id=sarah.id, nickname="Sarah Connor")

        # Add sample call logs
        now = datetime.now(timezone.utc)
        call1 = CallLog(
            caller_id=alex.id,
            receiver_id=sarah.id,
            call_type="video",
            status="completed",
            duration_seconds=342,
            started_at=now - timedelta(hours=2),
            ended_at=now - timedelta(hours=2) + timedelta(seconds=342)
        )
        call2 = CallLog(
            caller_id=emma.id,
            receiver_id=sarah.id,
            call_type="voice",
            status="missed",
            duration_seconds=0,
            started_at=now - timedelta(days=1),
            ended_at=now - timedelta(days=1)
        )

        db.session.add_all([contact1, contact2, contact3, call1, call2])
        db.session.commit()
        print("Database seeded successfully with demo accounts:")
        print("  1. Username: sarah | Password: password123")
        print("  2. Username: alex  | Password: password123")
        print("  3. Username: emma  | Password: password123")

if __name__ == "__main__":
    seed_database()
