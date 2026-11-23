from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from backend.database import db
from backend.models.call_log import CallLog
from backend.models.user import User
from backend.services.auth_service import token_required

calls_bp = Blueprint("calls", __name__)

@calls_bp.route("/recent", methods=["GET"])
@token_required
def get_recent_calls(current_user):
    limit = min(int(request.args.get("limit", 50)), 100)
    calls = CallLog.query.filter(
        (CallLog.caller_id == current_user.id) | (CallLog.receiver_id == current_user.id)
    ).order_by(CallLog.created_at.desc()).limit(limit).all()

    return jsonify({
        "success": True,
        "count": len(calls),
        "calls": [c.to_dict(current_user_id=current_user.id) for c in calls]
    }), 200

@calls_bp.route("/missed", methods=["GET"])
@token_required
def get_missed_calls(current_user):
    calls = CallLog.query.filter(
        CallLog.receiver_id == current_user.id,
        CallLog.status == "missed"
    ).order_by(CallLog.created_at.desc()).limit(50).all()

    return jsonify({
        "success": True,
        "count": len(calls),
        "calls": [c.to_dict(current_user_id=current_user.id) for c in calls]
    }), 200

@calls_bp.route("/stats", methods=["GET"])
@token_required
def get_call_stats(current_user):
    all_calls = CallLog.query.filter(
        (CallLog.caller_id == current_user.id) | (CallLog.receiver_id == current_user.id)
    ).all()

    total_calls = len(all_calls)
    total_duration_seconds = sum(c.duration_seconds or 0 for c in all_calls)
    voice_calls = sum(1 for c in all_calls if c.call_type == "voice")
    video_calls = sum(1 for c in all_calls if c.call_type == "video")
    missed_calls = sum(1 for c in all_calls if c.receiver_id == current_user.id and c.status == "missed")

    return jsonify({
        "success": True,
        "stats": {
            "total_calls": total_calls,
            "total_duration_minutes": round(total_duration_seconds / 60, 1),
            "voice_calls": voice_calls,
            "video_calls": video_calls,
            "missed_calls": missed_calls
        }
    }), 200
