import re
from flask import Blueprint, request, jsonify
from backend.database import db
from backend.models.user import User
from backend.services.auth_service import generate_token, token_required

auth_bp = Blueprint("auth", __name__)

USERNAME_REGEX = re.compile(r"^[a-zA-Z0-9_]{3,30}$")
EMAIL_REGEX = re.compile(r"^[\w\.-]+@[\w\.-]+\.\w+$")

@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    username = (data.get("username") or "").strip().lower()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    display_name = (data.get("display_name") or "").strip() or username

    if not username or not USERNAME_REGEX.match(username):
        return jsonify({
            "success": False,
            "message": "Username must be 3-30 characters long and contain only letters, numbers, and underscores."
        }), 400

    if not email or not EMAIL_REGEX.match(email):
        return jsonify({
            "success": False,
            "message": "Please provide a valid email address."
        }), 400

    if len(password) < 6:
        return jsonify({
            "success": False,
            "message": "Password must be at least 6 characters long."
        }), 400

    if User.query.filter_by(username=username).first():
        return jsonify({
            "success": False,
            "message": f"Username '@{username}' is already taken."
        }), 409

    if User.query.filter_by(email=email).first():
        return jsonify({
            "success": False,
            "message": "An account with this email already exists."
        }), 409

    user = User(
        username=username,
        email=email,
        display_name=display_name,
        bio=data.get("bio", "Hey there! I am using WebCall.")
    )
    user.set_password(password)

    db.session.add(user)
    db.session.commit()

    token = generate_token(user)
    return jsonify({
        "success": True,
        "message": "Registration successful! Welcome to WebCall.",
        "token": token,
        "user": user.to_dict(include_private=True)
    }), 201

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    login_id = (data.get("username") or data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not login_id or not password:
        return jsonify({
            "success": False,
            "message": "Please provide your username/email and password."
        }), 400

    user = User.query.filter(
        (User.username == login_id) | (User.email == login_id)
    ).first()

    if not user or not user.check_password(password):
        return jsonify({
            "success": False,
            "message": "Invalid username or password."
        }), 401

    token = generate_token(user)
    return jsonify({
        "success": True,
        "message": "Login successful.",
        "token": token,
        "user": user.to_dict(include_private=True)
    }), 200

@auth_bp.route("/me", methods=["GET"])
@token_required
def get_me(current_user):
    return jsonify({
        "success": True,
        "user": current_user.to_dict(include_private=True)
    }), 200
