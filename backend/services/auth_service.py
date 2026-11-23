from functools import wraps
from datetime import datetime, timezone
import jwt
from flask import request, jsonify, current_app
from backend.database import db
from backend.models.user import User

def generate_token(user: User) -> str:
    payload = {
        "user_id": user.id,
        "username": user.username,
        "exp": datetime.now(timezone.utc) + current_app.config["JWT_ACCESS_TOKEN_EXPIRES"],
        "iat": datetime.now(timezone.utc)
    }
    return jwt.encode(payload, current_app.config["JWT_SECRET_KEY"], algorithm="HS256")

def decode_token(token: str):
    try:
        payload = jwt.decode(token, current_app.config["JWT_SECRET_KEY"], algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get("Authorization")
        if auth_header:
            parts = auth_header.split()
            if len(parts) == 2 and parts[0].lower() == "bearer":
                token = parts[1]

        if not token:
            return jsonify({"success": False, "message": "Authentication token is missing"}), 401

        payload = decode_token(token)
        if not payload:
            return jsonify({"success": False, "message": "Token is invalid or expired"}), 401

        current_user = db.session.get(User, payload["user_id"])
        if not current_user:
            return jsonify({"success": False, "message": "User not found"}), 401

        return f(current_user, *args, **kwargs)

    return decorated
