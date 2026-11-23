import uuid
import threading
from datetime import datetime, timezone
from flask import request
from flask_socketio import emit
from backend.sockets import socketio
from backend.sockets.presence import get_user_sockets, get_socket_user, emit_to_user
from backend.database import db
from backend.models.user import User
from backend.models.call_log import CallLog

# Active call tracking
calls_lock = threading.Lock()
# call_id -> dict
active_calls = {}
# user_id -> call_id
user_active_calls = {}

CALL_TIMEOUT_SECONDS = 30

def init_signaling(app):
    def handle_call_timeout(call_id):
        with calls_lock:
            call = active_calls.get(call_id)
            if not call or call.get("status") != "ringing":
                return
            caller_id = call["caller_id"]
            receiver_id = call["receiver_id"]
            call_type = call["call_type"]
            started_at = call["started_at"]
            
            # Clean up active state
            active_calls.pop(call_id, None)
            user_active_calls.pop(caller_id, None)
            user_active_calls.pop(receiver_id, None)

        # Notify both parties
        emit_to_user(caller_id, "call-timeout", {
            "callId": call_id,
            "message": "Call timed out. No answer."
        })
        emit_to_user(receiver_id, "call-timeout", {
            "callId": call_id,
            "message": "Missed call."
        })

        # Save to database as missed call
        with app.app_context():
            try:
                log = CallLog(
                    caller_id=caller_id,
                    receiver_id=receiver_id,
                    call_type=call_type,
                    status="missed",
                    duration_seconds=0,
                    started_at=started_at,
                    ended_at=datetime.now(timezone.utc)
                )
                db.session.add(log)
                db.session.commit()
            except Exception as e:
                app.logger.error(f"Error logging missed call: {e}")

    @socketio.on("call-user")
    def handle_call_user(data):
        sid = request.sid
        caller_id = get_socket_user(sid)
        if not caller_id:
            emit("call-error", {"message": "You must be logged in to make calls."})
            return

        to_user_id = data.get("toUserId")
        call_type = data.get("callType", "voice")

        if not to_user_id:
            emit("call-error", {"message": "Target user ID is required."})
            return

        try:
            to_user_id = int(to_user_id)
        except (ValueError, TypeError):
            emit("call-error", {"message": "Invalid user ID."})
            return

        if to_user_id == caller_id:
            emit("call-error", {"message": "You cannot call yourself."})
            return

        with app.app_context():
            target_user = db.session.get(User, to_user_id)
            caller_user = db.session.get(User, caller_id)

            if not target_user:
                emit("call-error", {"message": "User does not exist."})
                return

            receiver_sids = get_user_sockets(to_user_id)
            if not receiver_sids:
                # Target is offline - record missed call immediately
                log = CallLog(
                    caller_id=caller_id,
                    receiver_id=to_user_id,
                    call_type=call_type,
                    status="missed",
                    duration_seconds=0,
                    started_at=datetime.now(timezone.utc),
                    ended_at=datetime.now(timezone.utc)
                )
                db.session.add(log)
                db.session.commit()

                emit("user-offline", {
                    "toUserId": to_user_id,
                    "targetUser": target_user.to_dict(),
                    "message": f"@{target_user.username} is currently offline."
                })
                return

            # Check if caller or receiver is busy in another call
            with calls_lock:
                if caller_id in user_active_calls:
                    emit("call-error", {"message": "You are already in a call."})
                    return
                if to_user_id in user_active_calls:
                    emit("user-busy", {
                        "toUserId": to_user_id,
                        "targetUser": target_user.to_dict(),
                        "message": f"@{target_user.username} is busy on another call."
                    })
                    return

                call_id = str(uuid.uuid4())
                timer = threading.Timer(CALL_TIMEOUT_SECONDS, handle_call_timeout, args=[call_id])
                timer.daemon = True

                call_state = {
                    "call_id": call_id,
                    "caller_id": caller_id,
                    "receiver_id": to_user_id,
                    "call_type": call_type,
                    "status": "ringing",
                    "started_at": datetime.now(timezone.utc),
                    "timer": timer
                }

                active_calls[call_id] = call_state
                user_active_calls[caller_id] = call_id
                user_active_calls[to_user_id] = call_id
                timer.start()

            # Notify caller that dialing started
            emit("outgoing-call-started", {
                "callId": call_id,
                "callType": call_type,
                "receiver": target_user.to_dict()
            })

            # Notify receiver of incoming call
            emit_to_user(to_user_id, "incoming-call", {
                "callId": call_id,
                "callType": call_type,
                "caller": caller_user.to_dict()
            })

    @socketio.on("accept-call")
    def handle_accept_call(data):
        sid = request.sid
        user_id = get_socket_user(sid)
        call_id = data.get("callId")

        timer_to_cancel = None
        caller_id = None
        call_type = None

        with calls_lock:
            call = active_calls.get(call_id)
            if not call:
                emit("call-error", {"message": "Call no longer exists."})
                return

            if call["receiver_id"] != user_id:
                emit("call-error", {"message": "Unauthorized to accept this call."})
                return

            timer_to_cancel = call.get("timer")
            call["status"] = "active"
            call["connected_at"] = datetime.now(timezone.utc)
            caller_id = call["caller_id"]
            call_type = call["call_type"]

        if timer_to_cancel:
            timer_to_cancel.cancel()

        # Notify caller that receiver accepted
        emit_to_user(caller_id, "call-accepted", {
            "callId": call_id,
            "callType": call_type
        })
        # Notify receiver that connection is establishing
        emit("call-accepted-ack", {
            "callId": call_id,
            "callType": call_type
        })

    @socketio.on("reject-call")
    def handle_reject_call(data):
        sid = request.sid
        user_id = get_socket_user(sid)
        call_id = data.get("callId")

        timer_to_cancel = None
        caller_id = None
        receiver_id = None
        call_type = None
        started_at = None

        with calls_lock:
            call = active_calls.get(call_id)
            if not call:
                return

            timer_to_cancel = call.get("timer")
            caller_id = call["caller_id"]
            receiver_id = call["receiver_id"]
            call_type = call["call_type"]
            started_at = call["started_at"]

            active_calls.pop(call_id, None)
            user_active_calls.pop(caller_id, None)
            user_active_calls.pop(receiver_id, None)

        if timer_to_cancel:
            timer_to_cancel.cancel()

        emit_to_user(caller_id, "call-rejected", {
            "callId": call_id,
            "message": "Call declined."
        })

        with app.app_context():
            try:
                log = CallLog(
                    caller_id=caller_id,
                    receiver_id=receiver_id,
                    call_type=call_type,
                    status="rejected",
                    duration_seconds=0,
                    started_at=started_at,
                    ended_at=datetime.now(timezone.utc)
                )
                db.session.add(log)
                db.session.commit()
            except Exception as e:
                app.logger.error(f"Error logging rejected call: {e}")

    @socketio.on("cancel-call")
    def handle_cancel_call(data):
        sid = request.sid
        user_id = get_socket_user(sid)
        call_id = data.get("callId")

        timer_to_cancel = None
        caller_id = None
        receiver_id = None
        call_type = None
        started_at = None

        with calls_lock:
            call = active_calls.get(call_id)
            if not call or call["caller_id"] != user_id:
                return

            timer_to_cancel = call.get("timer")
            caller_id = call["caller_id"]
            receiver_id = call["receiver_id"]
            call_type = call["call_type"]
            started_at = call["started_at"]

            active_calls.pop(call_id, None)
            user_active_calls.pop(caller_id, None)
            user_active_calls.pop(receiver_id, None)

        if timer_to_cancel:
            timer_to_cancel.cancel()

        emit_to_user(receiver_id, "call-cancelled", {
            "callId": call_id,
            "message": "Call was cancelled by caller."
        })

        with app.app_context():
            try:
                log = CallLog(
                    caller_id=caller_id,
                    receiver_id=receiver_id,
                    call_type=call_type,
                    status="cancelled",
                    duration_seconds=0,
                    started_at=started_at,
                    ended_at=datetime.now(timezone.utc)
                )
                db.session.add(log)
                db.session.commit()
            except Exception as e:
                app.logger.error(f"Error logging cancelled call: {e}")

    @socketio.on("sdp-offer")
    def handle_sdp_offer(data):
        sid = request.sid
        sender_id = get_socket_user(sid)
        call_id = data.get("callId")
        sdp = data.get("sdp")

        with calls_lock:
            call = active_calls.get(call_id)
            if not call:
                return
            peer_id = call["receiver_id"] if call["caller_id"] == sender_id else call["caller_id"]

        emit_to_user(peer_id, "sdp-offer", {
            "callId": call_id,
            "sdp": sdp
        })

    @socketio.on("sdp-answer")
    def handle_sdp_answer(data):
        sid = request.sid
        sender_id = get_socket_user(sid)
        call_id = data.get("callId")
        sdp = data.get("sdp")

        with calls_lock:
            call = active_calls.get(call_id)
            if not call:
                return
            peer_id = call["caller_id"] if call["receiver_id"] == sender_id else call["receiver_id"]

        emit_to_user(peer_id, "sdp-answer", {
            "callId": call_id,
            "sdp": sdp
        })

    @socketio.on("ice-candidate")
    def handle_ice_candidate(data):
        sid = request.sid
        sender_id = get_socket_user(sid)
        call_id = data.get("callId")
        candidate = data.get("candidate")

        with calls_lock:
            call = active_calls.get(call_id)
            if not call:
                return
            peer_id = call["receiver_id"] if call["caller_id"] == sender_id else call["caller_id"]

        emit_to_user(peer_id, "ice-candidate", {
            "callId": call_id,
            "candidate": candidate
        })

    @socketio.on("end-call")
    def handle_end_call(data):
        sid = request.sid
        sender_id = get_socket_user(sid)
        call_id = data.get("callId")
        client_duration = data.get("duration", 0)

        timer_to_cancel = None
        caller_id = None
        receiver_id = None
        call_type = None
        started_at = None
        connected_at = None

        with calls_lock:
            call = active_calls.get(call_id)
            if not call:
                return

            timer_to_cancel = call.get("timer")
            caller_id = call["caller_id"]
            receiver_id = call["receiver_id"]
            call_type = call["call_type"]
            started_at = call["started_at"]
            connected_at = call.get("connected_at")

            active_calls.pop(call_id, None)
            user_active_calls.pop(caller_id, None)
            user_active_calls.pop(receiver_id, None)

        if timer_to_cancel:
            timer_to_cancel.cancel()

        peer_id = receiver_id if sender_id == caller_id else caller_id

        # Calculate duration
        duration = int(client_duration)
        if connected_at and duration <= 0:
            duration = max(0, int((datetime.now(timezone.utc) - connected_at).total_seconds()))

        emit_to_user(peer_id, "call-ended", {
            "callId": call_id,
            "duration": duration,
            "message": "Call ended."
        })
        emit("call-ended", {
            "callId": call_id,
            "duration": duration,
            "message": "Call ended."
        })

        with app.app_context():
            try:
                log = CallLog(
                    caller_id=caller_id,
                    receiver_id=receiver_id,
                    call_type=call_type,
                    status="completed",
                    duration_seconds=duration,
                    started_at=started_at,
                    ended_at=datetime.now(timezone.utc)
                )
                db.session.add(log)
                db.session.commit()
            except Exception as e:
                app.logger.error(f"Error logging completed call: {e}")

    # Hook into socket disconnect to clean active calls
    @socketio.on_error_default
    def default_error_handler(e):
        app.logger.error(f"SocketIO error: {e}")
