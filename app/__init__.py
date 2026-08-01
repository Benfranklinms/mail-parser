"""
Flask application factory.

Creates and configures the Flask app with all blueprints, CORS, and
error handlers.
"""

import logging

from flask import Flask, jsonify
from flask_cors import CORS

from app.config import Config


def create_app() -> Flask:
    """Create and configure the Flask application.

    Returns:
        Configured Flask app instance.
    """
    app = Flask(__name__)
    app.config.from_object(Config)

    # --- Logging ---
    logging.basicConfig(
        level=logging.DEBUG if Config.DEBUG else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    # --- CORS (for future frontend) ---
    CORS(app, resources={
        r"/*": {
            "origins": ["http://localhost:3000", "http://localhost:5173"],
            "methods": ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
            "allow_headers": ["Authorization", "Content-Type"],
        }
    })

    # --- Register Blueprints ---
    from app.auth.routes import auth_bp
    from app.sync.routes import sync_bp
    from app.opportunities.routes import opportunities_bp
    from app.llm_keys.routes import llm_keys_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(sync_bp)
    app.register_blueprint(opportunities_bp)
    app.register_blueprint(llm_keys_bp)

    # --- Health check ---
    @app.route("/health", methods=["GET"])
    def health():
        return jsonify({"status": "ok", "service": "placement-mail-tracker"}), 200

    # --- Error Handlers ---
    @app.errorhandler(400)
    def bad_request(e):
        return jsonify({"error": "Bad request.", "details": str(e)}), 400

    @app.errorhandler(401)
    def unauthorized(e):
        return jsonify({"error": "Unauthorized. Please provide a valid token."}), 401

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Resource not found."}), 404

    @app.errorhandler(405)
    def method_not_allowed(e):
        return jsonify({"error": "Method not allowed."}), 405

    @app.errorhandler(500)
    def internal_error(e):
        return jsonify({"error": "Internal server error."}), 500

    # --- Startup validation ---
    with app.app_context():
        try:
            Config.validate()
            app.logger.info("Configuration validated successfully.")
        except ValueError as e:
            app.logger.warning(f"Configuration warning: {e}")

    app.logger.info("Placement Mail Tracker backend started.")

    return app
