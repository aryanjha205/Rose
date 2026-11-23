import os
from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS
from backend.config import Config
from backend.database import db, migrate
from backend.sockets import socketio
from backend.sockets.presence import init_presence
from backend.sockets.signaling import init_signaling

# Import models so Alembic / SQLAlchemy detects them
from backend.models.user import User
from backend.models.contact import Contact
from backend.models.call_log import CallLog

# Import Blueprints
from backend.routes.auth import auth_bp
from backend.routes.users import users_bp
from backend.routes.contacts import contacts_bp
from backend.routes.calls import calls_bp

def create_app(config_class=Config, config_override=None):
    frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
    
    app = Flask(
        __name__,
        static_folder=frontend_dir,
        static_url_path=""
    )
    if config_class:
        app.config.from_object(config_class)
    if config_override:
        app.config.update(config_override)

    # Enable CORS
    CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    socketio.init_app(app)

    # Register Blueprints
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(users_bp, url_prefix="/api/users")
    app.register_blueprint(contacts_bp, url_prefix="/api/contacts")
    app.register_blueprint(calls_bp, url_prefix="/api/calls")

    # Initialize Socket.IO Handlers
    init_presence(app)
    init_signaling(app)

    # Health check & system info
    @app.route("/api/health", methods=["GET"])
    def health_check():
        return jsonify({
            "status": "healthy",
            "service": "Rosé API & Signaling Backend",
            "version": "1.0.0",
            "timestamp": "2026-11-23"
        }), 200

    # STUN/TURN ICE configuration endpoint
    @app.route("/api/config/ice", methods=["GET"])
    def get_ice_servers():
        return jsonify({
            "iceServers": app.config.get("ICE_SERVERS", [])
        }), 200

    # VAPID Public Key for Web Push Notifications & Background Ringing
    @app.route("/api/config/vapid-key", methods=["GET"])
    def get_vapid_key():
        return jsonify({
            "vapidPublicKey": app.config.get("VAPID_PUBLIC_KEY")
        }), 200

    # Serve frontend SPA
    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve_spa(path):
        if path != "" and os.path.exists(os.path.join(frontend_dir, path)):
            return send_from_directory(frontend_dir, path)
        return send_from_directory(frontend_dir, "index.html")

    # Auto-create tables (e.g. push_subscriptions) if not existing
    with app.app_context():
        try:
            db.create_all()
            db.session.execute(db.text("ALTER TABLE users ALTER COLUMN avatar_url TYPE TEXT;"))
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            app.logger.warning(f"Database auto-table creation warning: {e}")

    return app

if __name__ == "__main__":
    app = create_app()
    port = int(os.environ.get("PORT", 5000))
    socketio.run(app, host="0.0.0.0", port=port, debug=False, allow_unsafe_werkzeug=True)
