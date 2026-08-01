"""
LLM key management routes.

Endpoints for saving, listing, and deleting user's LLM API keys.
Keys are encrypted at rest and never returned in full — only masked.
"""

import logging

from flask import Blueprint, request, jsonify, g

from app.auth.middleware import require_auth
from app.services.encryption import encrypt, get_last_four
from app.services.llm_providers import get_supported_providers
from app.db.client import get_client

logger = logging.getLogger(__name__)

llm_keys_bp = Blueprint("llm_keys", __name__, url_prefix="/llm-keys")

_VALID_PROVIDERS = {"gemini", "groq", "openrouter"}


@llm_keys_bp.route("", methods=["POST"])
@require_auth
def save_key():
    """Save or update an LLM API key.

    Request body:
    {
        "provider": "gemini",
        "api_key": "your-api-key-here"
    }

    The key is encrypted before storage and never returned in full.

    Returns:
        JSON with provider, masked key, and supported status.
    """
    data = request.get_json(silent=True) or {}
    provider = data.get("provider", "").lower().strip()
    api_key = data.get("api_key", "").strip()

    if not provider or provider not in _VALID_PROVIDERS:
        return jsonify({
            "error": f"Invalid provider. Must be one of: {', '.join(sorted(_VALID_PROVIDERS))}"
        }), 400

    if not api_key or len(api_key) < 8:
        return jsonify({"error": "API key is required and must be at least 8 characters."}), 400

    # Encrypt the key
    encrypted_key = encrypt(api_key)
    last_four = get_last_four(api_key)

    supabase = get_client(g.access_token)

    try:
        supabase.table("llm_keys").upsert(
            {
                "user_id": g.user_id,
                "provider": provider,
                "encrypted_api_key": encrypted_key,
                "key_last_four": last_four,
            },
            on_conflict="user_id,provider",
        ).execute()
    except Exception as e:
        logger.error(f"Failed to save LLM key: {e}")
        return jsonify({"error": "Failed to save API key."}), 500

    supported = provider in get_supported_providers()

    return jsonify({
        "message": f"API key saved for {provider}.",
        "provider": provider,
        "key_hint": f"****{last_four}",
        "supported": supported,
        "note": None if supported else f"{provider} provider is not yet implemented. Use 'gemini' for now.",
    }), 200


@llm_keys_bp.route("", methods=["GET"])
@require_auth
def list_keys():
    """List all configured LLM providers with masked keys.

    Returns:
        JSON with list of configured providers and their masked keys.
    """
    supabase = get_client(g.access_token)

    result = (
        supabase.table("llm_keys")
        .select("provider, key_last_four, created_at")
        .eq("user_id", g.user_id)
        .execute()
    )

    keys = []
    supported_providers = get_supported_providers()

    for row in result.data:
        keys.append({
            "provider": row["provider"],
            "key_hint": f"****{row['key_last_four']}",
            "created_at": row["created_at"],
            "supported": row["provider"] in supported_providers,
        })

    return jsonify({"data": keys}), 200


@llm_keys_bp.route("/<provider>", methods=["DELETE"])
@require_auth
def delete_key(provider):
    """Delete a stored LLM API key.

    Path params:
        - provider: The LLM provider name (gemini, groq, openrouter)

    Returns:
        JSON confirmation message.
    """
    provider = provider.lower().strip()

    if provider not in _VALID_PROVIDERS:
        return jsonify({
            "error": f"Invalid provider. Must be one of: {', '.join(sorted(_VALID_PROVIDERS))}"
        }), 400

    supabase = get_client(g.access_token)

    try:
        result = (
            supabase.table("llm_keys")
            .delete()
            .eq("user_id", g.user_id)
            .eq("provider", provider)
            .execute()
        )

        if not result.data:
            return jsonify({"error": f"No API key found for {provider}."}), 404

    except Exception as e:
        logger.error(f"Failed to delete LLM key: {e}")
        return jsonify({"error": "Failed to delete API key."}), 500

    return jsonify({"message": f"API key for {provider} deleted."}), 200
