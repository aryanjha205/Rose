from flask import Blueprint, request, jsonify
from backend.database import db
from backend.models.user import User
from backend.models.contact import Contact
from backend.services.auth_service import token_required

contacts_bp = Blueprint("contacts", __name__)

@contacts_bp.route("", methods=["GET"])
@token_required
def get_contacts(current_user):
    contacts = Contact.query.filter_by(user_id=current_user.id).order_by(Contact.created_at.desc()).all()
    results = [c.to_dict() for c in contacts]
    return jsonify({
        "success": True,
        "count": len(results),
        "contacts": results
    }), 200

@contacts_bp.route("", methods=["POST"])
@token_required
def add_contact(current_user):
    data = request.get_json() or {}
    contact_user_id = data.get("contact_user_id")
    username = (data.get("username") or "").strip().lower()
    nickname = (data.get("nickname") or "").strip() or None

    target_user = None
    if contact_user_id:
        target_user = db.session.get(User, contact_user_id)
    elif username:
        target_user = User.query.filter_by(username=username).first()

    if not target_user:
        return jsonify({"success": False, "message": "User not found."}), 404

    if target_user.id == current_user.id:
        return jsonify({"success": False, "message": "You cannot add yourself as a contact."}), 400

    existing = Contact.query.filter_by(
        user_id=current_user.id,
        contact_user_id=target_user.id
    ).first()

    if existing:
        return jsonify({"success": False, "message": f"@{target_user.username} is already in your contacts."}), 409

    new_contact = Contact(
        user_id=current_user.id,
        contact_user_id=target_user.id,
        nickname=nickname or target_user.display_name
    )

    db.session.add(new_contact)
    db.session.commit()

    return jsonify({
        "success": True,
        "message": f"@{target_user.username} added to contacts.",
        "contact": new_contact.to_dict()
    }), 201

@contacts_bp.route("/<int:contact_user_id>", methods=["DELETE"])
@token_required
def remove_contact(current_user, contact_user_id):
    contact = Contact.query.filter_by(
        user_id=current_user.id,
        contact_user_id=contact_user_id
    ).first()

    if not contact:
        return jsonify({"success": False, "message": "Contact not found."}), 404

    db.session.delete(contact)
    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Contact removed successfully."
    }), 200
