"""
Opportunities routes.

Endpoints for listing opportunities and updating application status.
"""

import logging
from datetime import datetime, timezone

from flask import Blueprint, request, jsonify, g

from app.auth.middleware import require_auth
from app.db.client import get_client

logger = logging.getLogger(__name__)

opportunities_bp = Blueprint("opportunities", __name__, url_prefix="/opportunities")

# Valid filter values
_VALID_ROLE_TYPES = {"internship", "full-time", "ppo", "unclear"}
_VALID_STATUSES = {"not_applied", "applied", "result_out"}


@opportunities_bp.route("", methods=["GET"])
@require_auth
def list_opportunities():
    """List all opportunities for the logged-in user.

    Query params:
        - role_type: Filter by role type (internship, full-time, ppo, unclear)
        - status: Filter by application status (not_applied, applied, result_out)
        - page: Page number (default: 1)
        - per_page: Items per page (default: 20, max: 100)
        - sort: Sort field (default: created_at)
        - order: Sort order (asc/desc, default: desc)

    Returns:
        JSON with 'data' (list of opportunities) and 'pagination' metadata.
    """
    supabase = get_client(g.access_token)

    # Parse query params
    role_type = request.args.get("role_type")
    status_filter = request.args.get("status")
    page = max(1, int(request.args.get("page", 1)))
    per_page = min(100, max(1, int(request.args.get("per_page", 20))))
    sort_field = request.args.get("sort", "created_at")
    order = request.args.get("order", "desc")

    # Build query
    query = (
        supabase.table("opportunities")
        .select(
            "*, applications(status, applied_at)",
            count="exact",
        )
        .eq("user_id", g.user_id)
    )

    # Apply filters
    if role_type and role_type in _VALID_ROLE_TYPES:
        query = query.eq("role_type", role_type)

    # Calculate pagination
    offset = (page - 1) * per_page
    query = query.range(offset, offset + per_page - 1)

    # Apply sorting
    desc = order.lower() == "desc"
    if sort_field in ("created_at", "updated_at", "company", "role", "last_date"):
        query = query.order(sort_field, desc=desc)
    else:
        query = query.order("created_at", desc=True)

    result = query.execute()

    # Format response
    opportunities = []
    for opp in result.data:
        # Flatten application status
        apps = opp.pop("applications", [])
        app_status = "not_applied"
        applied_at = None

        if apps:
            app_status = apps[0].get("status", "not_applied")
            applied_at = apps[0].get("applied_at")

        opp["application_status"] = app_status
        opp["applied_at"] = applied_at
        opportunities.append(opp)

    # Filter by application status if requested
    if status_filter and status_filter in _VALID_STATUSES:
        opportunities = [
            o for o in opportunities
            if o["application_status"] == status_filter
        ]

    total_count = result.count if result.count is not None else len(opportunities)

    return jsonify({
        "data": opportunities,
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total_count,
            "total_pages": max(1, (total_count + per_page - 1) // per_page),
        },
    }), 200


@opportunities_bp.route("/<opportunity_id>", methods=["GET"])
@require_auth
def get_opportunity(opportunity_id):
    """Get a single opportunity by ID.

    Returns:
        JSON with the opportunity data and its application status.
    """
    supabase = get_client(g.access_token)

    result = (
        supabase.table("opportunities")
        .select("*, applications(status, applied_at)")
        .eq("id", opportunity_id)
        .eq("user_id", g.user_id)
        .execute()
    )

    if not result.data:
        return jsonify({"error": "Opportunity not found."}), 404

    opp = result.data[0]
    apps = opp.pop("applications", [])
    opp["application_status"] = apps[0]["status"] if apps else "not_applied"
    opp["applied_at"] = apps[0].get("applied_at") if apps else None

    return jsonify({"data": opp}), 200


@opportunities_bp.route("/<opportunity_id>/status", methods=["PATCH"])
@require_auth
def update_status(opportunity_id):
    """Update the application status for an opportunity.

    Request body:
    {
        "status": "applied"  // not_applied, applied, or result_out
    }

    Creates an application record if one doesn't exist, updates if it does.
    """
    data = request.get_json(silent=True) or {}
    new_status = data.get("status")

    if not new_status or new_status not in _VALID_STATUSES:
        return jsonify({
            "error": f"Invalid status. Must be one of: {', '.join(_VALID_STATUSES)}"
        }), 400

    supabase = get_client(g.access_token)

    # Verify the opportunity belongs to this user
    opp_result = (
        supabase.table("opportunities")
        .select("id")
        .eq("id", opportunity_id)
        .eq("user_id", g.user_id)
        .execute()
    )

    if not opp_result.data:
        return jsonify({"error": "Opportunity not found."}), 404

    # Upsert the application record
    application_data = {
        "user_id": g.user_id,
        "opportunity_id": opportunity_id,
        "status": new_status,
    }

    # Set applied_at timestamp when marking as applied
    if new_status == "applied":
        application_data["applied_at"] = datetime.now(timezone.utc).isoformat()

    try:
        supabase.table("applications").upsert(
            application_data,
            on_conflict="user_id,opportunity_id",
        ).execute()
    except Exception as e:
        logger.error(f"Failed to update application status: {e}")
        return jsonify({"error": "Failed to update status."}), 500

    return jsonify({
        "message": f"Status updated to '{new_status}'.",
        "opportunity_id": opportunity_id,
        "status": new_status,
    }), 200
