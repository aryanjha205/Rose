from flask import Blueprint, request, jsonify
from backend.database import db
from backend.models.user import User
from backend.models.contact import Contact
from backend.models.contact_request import ContactRequest
from backend.models.push_subscription import PushSubscription
from backend.services.auth_service import token_required
from backend.services.cloudinary_service import upload_avatar

users_bp = Blueprint("users", __name__)

@users_bp.route("/search", methods=["GET"])
@token_required
def search_users(current_user):
    query = (request.args.get("q") or "").strip().lower()
    if not query:
        # Return suggested users
        users = User.query.filter(User.id != current_user.id).limit(15).all()
    else:
        search_filter = f"%{query}%"
        users = User.query.filter(
            User.id != current_user.id,
            (User.username.ilike(search_filter) | User.display_name.ilike(search_filter))
        ).limit(25).all()

    # Get contact IDs for current user to mark 'is_contact'
    user_contact_ids = {
        c.contact_user_id for c in Contact.query.filter_by(user_id=current_user.id).all()
    }

    # Get pending sent requests
    sent_requests = {
        r.receiver_id: r.id for r in ContactRequest.query.filter_by(sender_id=current_user.id, status="pending").all()
    }

    # Get pending received requests
    received_requests = {
        r.sender_id: r.id for r in ContactRequest.query.filter_by(receiver_id=current_user.id, status="pending").all()
    }

    results = []
    for u in users:
        u_dict = u.to_dict()
        u_dict["is_contact"] = u.id in user_contact_ids
        u_dict["has_sent_request"] = u.id in sent_requests
        u_dict["has_received_request"] = u.id in received_requests
        u_dict["pending_request_id"] = sent_requests.get(u.id) or received_requests.get(u.id)
        results.append(u_dict)

    return jsonify({
        "success": True,
        "count": len(results),
        "users": results
    }), 200

@users_bp.route("/<string:username>", methods=["GET"])
@token_required
def get_user_profile(current_user, username):
    target = User.query.filter_by(username=username.lower().strip()).first()
    if not target:
        return jsonify({"success": False, "message": "User not found"}), 404

    is_contact = Contact.query.filter_by(
        user_id=current_user.id, contact_user_id=target.id
    ).first() is not None

    sent_req = ContactRequest.query.filter_by(
        sender_id=current_user.id, receiver_id=target.id, status="pending"
    ).first()

    received_req = ContactRequest.query.filter_by(
        sender_id=target.id, receiver_id=current_user.id, status="pending"
    ).first()

    u_dict = target.to_dict()
    u_dict["is_contact"] = is_contact
    u_dict["has_sent_request"] = sent_req is not None
    u_dict["has_received_request"] = received_req is not None
    u_dict["pending_request_id"] = sent_req.id if sent_req else (received_req.id if received_req else None)
    u_dict["is_self"] = target.id == current_user.id

    return jsonify({
        "success": True,
        "user": u_dict
    }), 200

@users_bp.route("/profile", methods=["PUT"])
@token_required
def update_profile(current_user):
    data = request.get_json() or {}
    display_name = data.get("display_name")
    bio = data.get("bio")
    avatar_url = data.get("avatar_url")

    if display_name:
        current_user.display_name = display_name.strip()
    if bio is not None:
        current_user.bio = bio.strip()
    if avatar_url:
        current_user.avatar_url = avatar_url.strip()

    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Profile updated successfully.",
        "user": current_user.to_dict(include_private=True)
    }), 200

@users_bp.route("/avatar", methods=["POST"])
@token_required
def upload_user_avatar(current_user):
    if "avatar" not in request.files:
        return jsonify({"success": False, "message": "No avatar file provided."}), 400

    file = request.files["avatar"]
    if file.filename == "":
        return jsonify({"success": False, "message": "No selected file."}), 400

    try:
        avatar_url = upload_avatar(file, current_user.id)
    except Exception as e:
        return jsonify({"success": False, "message": f"Avatar upload error: {str(e)}"}), 400

    current_user.avatar_url = avatar_url
    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Avatar updated successfully.",
        "avatar_url": avatar_url,
        "user": current_user.to_dict(include_private=True)
    }), 200

@users_bp.route("/password", methods=["PUT"])
@token_required
def update_password(current_user):
    data = request.get_json() or {}
    current_password = data.get("current_password") or ""
    new_password = data.get("new_password") or ""

    if not current_user.check_password(current_password):
        return jsonify({"success": False, "message": "Current password is incorrect."}), 400

    if len(new_password) < 6:
        return jsonify({"success": False, "message": "New password must be at least 6 characters long."}), 400

    current_user.set_password(new_password)
    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Password updated successfully."
    }), 200

@users_bp.route("/push-subscription", methods=["POST"])
@token_required
def save_push_subscription(current_user):
    data = request.get_json() or {}
    endpoint = data.get("endpoint")
    keys = data.get("keys", {})
    p256dh = keys.get("p256dh")
    auth = keys.get("auth")

    if not endpoint or not p256dh or not auth:
        return jsonify({"success": False, "message": "Invalid subscription payload."}), 400

    existing = PushSubscription.query.filter_by(endpoint=endpoint).first()
    if existing:
        existing.user_id = current_user.id
        existing.p256dh = p256dh
        existing.auth = auth
    else:
        new_sub = PushSubscription(
            user_id=current_user.id,
            endpoint=endpoint,
            p256dh=p256dh,
            auth=auth
        )
        db.session.add(new_sub)

    db.session.commit()
    return jsonify({"success": True, "message": "Push subscription saved successfully."}), 200
