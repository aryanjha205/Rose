from datetime import datetime, timezone
import bcrypt
from backend.database import db

class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(32), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    display_name = db.Column(db.String(64), nullable=False)
    avatar_url = db.Column(db.Text, nullable=True)
    bio = db.Column(db.String(255), default="Hey there! I am using WebCall.")
    is_online = db.Column(db.Boolean, default=False)
    last_seen = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    contacts = db.relationship(
        "Contact",
        foreign_keys="Contact.user_id",
        backref="owner",
        lazy="dynamic",
        cascade="all, delete-orphan"
    )

    def set_password(self, password: str):
        salt = bcrypt.gensalt()
        self.password_hash = bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

    def check_password(self, password: str) -> bool:
        return bcrypt.checkpw(password.encode("utf-8"), self.password_hash.encode("utf-8"))

    def to_dict(self, include_private=False):
        data = {
            "id": self.id,
            "username": self.username,
            "display_name": self.display_name,
            "avatar_url": self.avatar_url or f"https://api.dicebear.com/7.x/initials/svg?seed={self.username}&backgroundColor=FF4F9A,F72585&textColor=ffffff",
            "bio": self.bio,
            "is_online": self.is_online,
            "last_seen": self.last_seen.isoformat() if self.last_seen else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if include_private:
            data["email"] = self.email
        return data
