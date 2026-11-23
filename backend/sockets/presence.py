import threading
from datetime import datetime, timezone
from flask import request
from flask_socketio import emit
from backend.sockets import socketio
from backend.services.auth_service import decode_token
from backend.database import db
from backend.models.user import User

# In-memory mappings protected by a lock
presence_lock = threading.Lock()
# user_id -> set of socket session IDs
user_sockets = {}
# socket_id -> user_id
socket_users = {}

def get_user_sockets(user_id: int):
    with presence_lock:
        return list(user_sockets.get(user_id, set()))

def get_socket_user(socket_id: str):
    with presence_lock:
        return socket_users.get(socket_id)

def emit_to_user(user_id: int, event: str, data):
    sids = get_user_sockets(user_id)
    for sid in sids:
        socketio.emit(event, data, room=sid)

def init_presence(app):
    @socketio.on("connect")
    def handle_connect(auth=None):
        token = None
        if auth and isinstance(auth, dict):
            token = auth.get("token")
        if not token:
            token = request.args.get("token")

        if not token:
            # Client connected without auth yet; they will authenticate via 'authenticate' event
            return

        _authenticate_socket(request.sid, token)

    @socketio.on("authenticate")
    def handle_authenticate(data):
        token = data.get("token") if isinstance(data, dict) else None
        if not token:
            emit("auth-error", {"message": "Token missing"})
            return
        _authenticate_socket(request.sid, token)

    def _authenticate_socket(sid, token):
        with app.app_context():
            payload = decode_token(token)
            if not payload:
                emit("auth-error", {"message": "Invalid or expired token"}, room=sid)
                return

            user_id = payload.get("user_id")
            user = db.session.get(User, user_id)
            if not user:
                emit("auth-error", {"message": "User not found"}, room=sid)
                return

            became_online = False
            with presence_lock:
                if user_id not in user_sockets:
                    user_sockets[user_id] = set()
                    became_online = True
                user_sockets[user_id].add(sid)
                socket_users[sid] = user_id

            if became_online:
                user.is_online = True
                user.last_seen = datetime.now(timezone.utc)
                db.session.commit()
                socketio.emit("user-status", {"userId": user_id, "isOnline": True})

            emit("authenticated", {
                "success": True,
                "user": user.to_dict()
            }, room=sid)

    @socketio.on("disconnect")
    def handle_disconnect(*args, **kwargs):
        sid = request.sid
        user_id = None
        went_offline = False

        with presence_lock:
            user_id = socket_users.pop(sid, None)
            if user_id and user_id in user_sockets:
                user_sockets[user_id].discard(sid)
                if not user_sockets[user_id]:
                    del user_sockets[user_id]
                    went_offline = True

        if user_id and went_offline:
            with app.app_context():
                user = db.session.get(User, user_id)
                if user:
                    user.is_online = False
                    user.last_seen = datetime.now(timezone.utc)
                    db.session.commit()
                socketio.emit("user-status", {"userId": user_id, "isOnline": False})
