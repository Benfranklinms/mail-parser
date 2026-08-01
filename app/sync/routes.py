"""
Sync routes.

Endpoints for checking sync job status and triggering incremental sync.
"""

import logging

from flask import Blueprint, jsonify, g, current_app

from app.auth.middleware import require_auth
from app.services.sync_manager import get_user_latest_job, run_incremental_sync

logger = logging.getLogger(__name__)

sync_bp = Blueprint("sync", __name__, url_prefix="/sync")


@sync_bp.route("/status", methods=["GET"])
@require_auth
def sync_status():
    """Get the current sync job status for the logged-in user.

    Returns:
        JSON with job progress: status, total, processed, extracted,
        filtered, errors, timestamps.
    """
    job = get_user_latest_job(g.user_id)

    if not job:
        return jsonify({
            "status": "no_jobs",
            "message": "No sync jobs found. Connect your Gmail account first.",
        }), 200

    return jsonify(job), 200


@sync_bp.route("/incremental", methods=["POST"])
@require_auth
def trigger_incremental():
    """Trigger an incremental sync for the logged-in user.

    Fetches new emails since the last sync using Gmail's history API.

    Returns:
        JSON with job_id and initial status.
    """
    try:
        result = run_incremental_sync(
            user_id=g.user_id,
            app=current_app._get_current_object(),
        )

        status_code = 202 if result["status"] == "processing" else 200
        return jsonify(result), status_code

    except Exception as e:
        logger.error(f"Failed to start incremental sync: {e}")
        return jsonify({"error": "Failed to start sync."}), 500
