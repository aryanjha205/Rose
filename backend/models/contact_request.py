from datetime import datetime, timezone
from backend.database import db

class ContactRequest(db.Model):
    __tablename__ = "contact_requests"

    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    receiver_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    status = db.Column(db.String(20), default="pending", nullable=False)  # 'pending', 'accepted', 'rejected'
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    sender = db.relationship("User", foreign_keys=[sender_id])
    receiver = db.relationship("User", foreign_keys=[receiver_id])

    __table_args__ = (
        db.UniqueConstraint("sender_id", "receiver_id", name="uq_sender_receiver_request"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "sender_id": self.sender_id,
            "receiver_id": self.receiver_id,
            "status": self.status,
            "sender": self.sender.to_dict() if self.sender else None,
            "receiver": self.receiver.to_dict() if self.receiver else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
