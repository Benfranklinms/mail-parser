"""
Sync routes.

Endpoints for checking sync job status and triggering backfill or incremental sync.
"""

import logging
from flask import Blueprint, jsonify, request, g, current_app

from app.auth.middleware import require_auth
from app.services.sync_manager import get_user_latest_job, run_incremental_sync, start_backfill

logger = logging.getLogger(__name__)

sync_bp = Blueprint("sync", __name__, url_prefix="/sync")


@sync_bp.route("/status", methods=["GET"])
@require_auth
def sync_status():
    """Get the current sync job status for the logged-in user."""
    job = get_user_latest_job(g.user_id)

    if not job:
        return jsonify({
            "status": "no_jobs",
            "message": "No sync jobs found. Connect your Gmail account first.",
        }), 200

    return jsonify(job), 200


@sync_bp.route("/trigger", methods=["POST"])
@sync_bp.route("/incremental", methods=["POST"])
@require_auth
def trigger_sync():
    """Trigger a sync for the logged-in user.

    Request body (optional):
    {
        "start_date": "2026-08-01" // ISO date string
    }
    """
    data = request.get_json(silent=True) or {}
    start_date = data.get("start_date")

    try:
        if start_date:
            logger.info(f"Triggering backfill sync from start_date: {start_date}")
            result = start_backfill(
                user_id=g.user_id,
                start_date=start_date,
                app=current_app._get_current_object(),
            )
        else:
            logger.info("Triggering incremental sync")
            result = run_incremental_sync(
                user_id=g.user_id,
                app=current_app._get_current_object(),
            )

        status_code = 202 if result.get("status") == "processing" else 200
        return jsonify(result), status_code

    except Exception as e:
        logger.error(f"Failed to start sync: {e}")
        return jsonify({"error": "Failed to start sync."}), 500
