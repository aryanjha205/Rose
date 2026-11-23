from flask import Blueprint, request, jsonify
from backend.database import db
from backend.models.user import User
from backend.models.contact import Contact
from backend.models.contact_request import ContactRequest
from backend.services.auth_service import token_required
from backend.sockets.presence import emit_to_user

contacts_bp = Blueprint("contacts", __name__)

@contacts_bp.route("", methods=["GET"])
@token_required
def get_contacts(current_user):
    """
    Get all approved contacts for the current user.
    """
    contacts = Contact.query.filter_by(user_id=current_user.id).order_by(Contact.created_at.desc()).all()
    results = [c.to_dict() for c in contacts]
    return jsonify({
        "success": True,
        "count": len(results),
        "contacts": results
    }), 200

@contacts_bp.route("/requests", methods=["GET"])
@token_required
def get_contact_requests(current_user):
    """
    Get incoming and outgoing pending contact requests.
    """
    incoming = ContactRequest.query.filter_by(
        receiver_id=current_user.id,
        status="pending"
    ).order_by(ContactRequest.created_at.desc()).all()

    outgoing = ContactRequest.query.filter_by(
        sender_id=current_user.id,
        status="pending"
    ).order_by(ContactRequest.created_at.desc()).all()

    return jsonify({
        "success": True,
        "incoming": [r.to_dict() for r in incoming],
        "outgoing": [r.to_dict() for r in outgoing]
    }), 200

@contacts_bp.route("/requests", methods=["POST"])
@contacts_bp.route("", methods=["POST"])
@token_required
def send_contact_request(current_user):
    """
    Send a contact request to another user. Requires receiver's approval before adding.
    """
    data = request.get_json() or {}
    contact_user_id = data.get("contact_user_id")
    username = (data.get("username") or "").strip().lower().replace("@", "")

    target_user = None
    if contact_user_id:
        target_user = db.session.get(User, contact_user_id)
    elif username:
        target_user = User.query.filter_by(username=username).first()

    if not target_user:
        return jsonify({"success": False, "message": "User not found."}), 404

    if target_user.id == current_user.id:
        return jsonify({"success": False, "message": "You cannot add yourself as a contact."}), 400

    # 1. Check if already mutual contacts
    existing_contact = Contact.query.filter_by(
        user_id=current_user.id,
        contact_user_id=target_user.id
    ).first()
    if existing_contact:
        return jsonify({"success": False, "message": f"@{target_user.username} is already in your contacts."}), 409

    # 2. Check if current_user already sent a pending request
    already_sent = ContactRequest.query.filter_by(
        sender_id=current_user.id,
        receiver_id=target_user.id,
        status="pending"
    ).first()
    if already_sent:
        return jsonify({"success": False, "message": f"Contact request to @{target_user.username} is already pending."}), 409

    # 3. Check if target_user already sent a request to current_user -> Auto-accept!
    reverse_request = ContactRequest.query.filter_by(
        sender_id=target_user.id,
        receiver_id=current_user.id,
        status="pending"
    ).first()
    if reverse_request:
        reverse_request.status = "accepted"
        # Add mutual contacts
        if not Contact.query.filter_by(user_id=current_user.id, contact_user_id=target_user.id).first():
            db.session.add(Contact(user_id=current_user.id, contact_user_id=target_user.id))
        if not Contact.query.filter_by(user_id=target_user.id, contact_user_id=current_user.id).first():
            db.session.add(Contact(user_id=target_user.id, contact_user_id=current_user.id))
        db.session.commit()

        emit_to_user(target_user.id, "contact-request-accepted", {
            "user": current_user.to_dict()
        })

        return jsonify({
            "success": True,
            "message": f"You and @{target_user.username} are now contacts!",
            "status": "accepted"
        }), 200

    # 4. Create new pending request
    new_request = ContactRequest(
        sender_id=current_user.id,
        receiver_id=target_user.id,
        status="pending"
    )
    db.session.add(new_request)
    db.session.commit()

    # Real-time notification to receiver
    emit_to_user(target_user.id, "contact-request-received", {
        "request": new_request.to_dict()
    })

    return jsonify({
        "success": True,
        "message": f"Contact request sent to @{target_user.username}. Waiting for their approval.",
        "request": new_request.to_dict(),
        "status": "pending"
    }), 201

@contacts_bp.route("/requests/<int:request_id>/accept", methods=["POST"])
@token_required
def accept_contact_request(current_user, request_id):
    """
    Accept an incoming contact request. Adds mutual contacts for both users.
    """
    req = db.session.get(ContactRequest, request_id)
    if not req or req.receiver_id != current_user.id:
        return jsonify({"success": False, "message": "Contact request not found or unauthorized."}), 404

    if req.status != "pending":
        return jsonify({"success": False, "message": f"Request is already {req.status}."}), 400

    req.status = "accepted"

    # Add mutual contacts in Contact table
    c1 = Contact.query.filter_by(user_id=current_user.id, contact_user_id=req.sender_id).first()
    if not c1:
        db.session.add(Contact(user_id=current_user.id, contact_user_id=req.sender_id))

    c2 = Contact.query.filter_by(user_id=req.sender_id, contact_user_id=current_user.id).first()
    if not c2:
        db.session.add(Contact(user_id=req.sender_id, contact_user_id=current_user.id))

    db.session.commit()

    # Real-time notification to sender that request was accepted
    emit_to_user(req.sender_id, "contact-request-accepted", {
        "user": current_user.to_dict(),
        "requestId": req.id
    })

    return jsonify({
        "success": True,
        "message": "Contact request accepted! Added to your contacts.",
        "request": req.to_dict()
    }), 200

@contacts_bp.route("/requests/<int:request_id>/decline", methods=["POST"])
@token_required
def decline_contact_request(current_user, request_id):
    """
    Decline an incoming contact request.
    """
    req = db.session.get(ContactRequest, request_id)
    if not req or req.receiver_id != current_user.id:
        return jsonify({"success": False, "message": "Contact request not found or unauthorized."}), 404

    db.session.delete(req)
    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Contact request declined."
    }), 200

@contacts_bp.route("/requests/<int:request_id>", methods=["DELETE"])
@token_required
def cancel_contact_request(current_user, request_id):
    """
    Cancel a contact request sent by the current user.
    """
    req = db.session.get(ContactRequest, request_id)
    if not req or (req.sender_id != current_user.id and req.receiver_id != current_user.id):
        return jsonify({"success": False, "message": "Contact request not found or unauthorized."}), 404

    db.session.delete(req)
    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Contact request cancelled."
    }), 200

@contacts_bp.route("/<int:contact_user_id>", methods=["DELETE"])
@token_required
def remove_contact(current_user, contact_user_id):
    """
    Remove a user from contacts.
    """
    contact = Contact.query.filter_by(
        user_id=current_user.id,
        contact_user_id=contact_user_id
    ).first()

    if not contact:
        return jsonify({"success": False, "message": "Contact not found."}), 404

    db.session.delete(contact)

    # Clean up any accepted request between these two users so they can re-request later
    existing_req = ContactRequest.query.filter(
        ((ContactRequest.sender_id == current_user.id) & (ContactRequest.receiver_id == contact_user_id)) |
        ((ContactRequest.sender_id == contact_user_id) & (ContactRequest.receiver_id == current_user.id))
    ).first()
    if existing_req:
        db.session.delete(existing_req)

    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Contact removed successfully."
    }), 200
