"""
Gmail OAuth routes.

Handles the OAuth flow for connecting a user's Gmail account:
- POST /auth/gmail/connect — generates the consent URL
- GET /auth/gmail/callback — handles the OAuth callback
"""

import json
import logging

from flask import Blueprint, request, jsonify, redirect, current_app, g

from app.auth.middleware import require_auth
from app.services import gmail as gmail_service
from app.services.encryption import encrypt
from app.services.sync_manager import start_backfill
from app.db.client import get_client, get_service_client

logger = logging.getLogger(__name__)

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")


@auth_bp.route("/gmail/connect", methods=["POST"])
@require_auth
def gmail_connect():
    """Start the Gmail OAuth flow.

    Request body (optional):
    {
        "start_date": "2025-01-01",      // ISO date for backfill start
        "sender_filter": "placement@college.edu"  // optional sender filter
    }

    Returns:
        JSON with 'auth_url' to redirect the user to.
    """
    data = request.get_json(silent=True) or {}

    start_date = data.get("start_date")
    sender_filter = data.get("sender_filter")

    # Pack user context + sync params into state for the callback
    state = json.dumps({
        "user_id": g.user_id,
        "start_date": start_date,
        "sender_filter": sender_filter,
    })

    auth_url = gmail_service.get_auth_url(state=state)

    return jsonify({"auth_url": auth_url}), 200


@auth_bp.route("/gmail/callback", methods=["GET"])
def gmail_callback():
    """Handle the Gmail OAuth callback.

    This endpoint is called by Google after the user grants consent.
    It exchanges the auth code for tokens, stores the encrypted
    refresh token, and triggers a background backfill sync.

    Query params (set by Google):
        - code: Authorization code
        - state: Our state string with user context
    """
    code = request.args.get("code")
    state_str = request.args.get("state")
    error = request.args.get("error")

    if error:
        logger.warning(f"Gmail OAuth error: {error}")
        return jsonify({"error": f"Gmail authorization denied: {error}"}), 400

    if not code or not state_str:
        return jsonify({"error": "Missing authorization code or state."}), 400

    # Parse state
    try:
        state = json.loads(state_str)
        user_id = state.get("user_id")
        start_date = state.get("start_date")
        sender_filter = state.get("sender_filter")
    except (json.JSONDecodeError, AttributeError):
        return jsonify({"error": "Invalid state parameter."}), 400

    if not user_id:
        return jsonify({"error": "Missing user context in state."}), 400

    # Exchange code for tokens
    try:
        tokens = gmail_service.exchange_code(code)
    except Exception as e:
        logger.error(f"Failed to exchange OAuth code: {e}")
        return jsonify({"error": "Failed to complete Gmail authorization."}), 500

    refresh_token = tokens.get("refresh_token")
    if not refresh_token:
        return jsonify({
            "error": "No refresh token received. Please revoke app access in Google Account settings and try again."
        }), 400

    # Encrypt and store the refresh token
    try:
        encrypted_token = encrypt(refresh_token)

        supabase = get_service_client()

        # Upsert — update if connection already exists
        supabase.table("email_connections").upsert(
            {
                "user_id": user_id,
                "encrypted_refresh_token": encrypted_token,
            },
            on_conflict="user_id",
        ).execute()

        logger.info(f"Gmail connected for user {user_id}")

    except Exception as e:
        logger.error(f"Failed to store Gmail connection: {e}")
        return jsonify({"error": "Failed to save Gmail connection."}), 500

    # Trigger background backfill
    try:
        job_result = start_backfill(
            user_id=user_id,
            start_date=start_date,
            sender_filter=sender_filter,
            app=current_app._get_current_object(),
        )
        logger.info(f"Backfill started: {job_result}")
    except Exception as e:
        logger.error(f"Failed to start backfill: {e}")
        # Don't fail the whole callback — connection is saved
        job_result = {"status": "backfill_failed", "error": str(e)}

    return jsonify({
        "message": "Gmail connected successfully.",
        "sync": job_result,
    }), 200


@auth_bp.route("/gmail/status", methods=["GET"])
@require_auth
def gmail_connection_status():
    """Check if the user has connected their Gmail account.

    Returns:
        JSON with connection status and last sync time.
    """
    supabase = get_client(g.access_token)

    result = (
        supabase.table("email_connections")
        .select("last_synced_at, created_at")
        .eq("user_id", g.user_id)
        .execute()
    )

    if result.data:
        conn = result.data[0]
        return jsonify({
            "connected": True,
            "last_synced_at": conn.get("last_synced_at"),
            "connected_at": conn.get("created_at"),
        }), 200

    return jsonify({"connected": False}), 200
