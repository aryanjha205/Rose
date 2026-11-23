from datetime import datetime, timezone
from backend.database import db

class Contact(db.Model):
    __tablename__ = "contacts"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    contact_user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    nickname = db.Column(db.String(64), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    contact_user = db.relationship("User", foreign_keys=[contact_user_id])

    __table_args__ = (
        db.UniqueConstraint("user_id", "contact_user_id", name="uq_user_contact"),
    )

    def to_dict(self):
        contact_info = self.contact_user.to_dict() if self.contact_user else {}
        return {
            "id": self.id,
            "user_id": self.user_id,
            "contact_user_id": self.contact_user_id,
            "nickname": self.nickname or contact_info.get("display_name"),
            "contact_user": contact_info,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
