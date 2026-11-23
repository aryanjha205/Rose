from datetime import datetime, timezone
from backend.database import db

class CallLog(db.Model):
    __tablename__ = "call_logs"

    id = db.Column(db.Integer, primary_key=True)
    caller_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    receiver_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    call_type = db.Column(db.String(16), nullable=False, default="voice") # "voice" or "video"
    status = db.Column(db.String(20), nullable=False, default="initiated") # "completed", "missed", "rejected", "cancelled"
    duration_seconds = db.Column(db.Integer, default=0)
    started_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    ended_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    caller = db.relationship("User", foreign_keys=[caller_id])
    receiver = db.relationship("User", foreign_keys=[receiver_id])

    def to_dict(self, current_user_id=None):
        is_outgoing = current_user_id == self.caller_id if current_user_id else None
        other_user = self.receiver if is_outgoing else self.caller
        return {
            "id": self.id,
            "caller_id": self.caller_id,
            "receiver_id": self.receiver_id,
            "call_type": self.call_type,
            "status": self.status,
            "duration_seconds": self.duration_seconds,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "ended_at": self.ended_at.isoformat() if self.ended_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "is_outgoing": is_outgoing,
            "other_user": other_user.to_dict() if other_user else None,
            "caller": self.caller.to_dict() if self.caller else None,
            "receiver": self.receiver.to_dict() if self.receiver else None
        }
