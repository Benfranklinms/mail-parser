"""
LLM key management routes.

Endpoints for saving, listing, and deleting user's LLM API keys.
Keys are encrypted at rest and never returned in full — only masked.
"""

import time
import logging
import threading
import requests
from flask import Blueprint, request, jsonify, g

from app.auth.middleware import require_auth
from app.services.encryption import encrypt, get_last_four
from app.services.llm_providers import get_supported_providers
from app.db.client import get_client

logger = logging.getLogger(__name__)

llm_keys_bp = Blueprint("llm_keys", __name__, url_prefix="/llm-keys")

_VALID_PROVIDERS = {"gemini", "groq", "openrouter"}

# Shortlist of curated models known to work well for structured JSON extraction
_CURATED_MODEL_IDS = {
    "google/gemini-2.5-flash",
    "meta-llama/llama-3.1-8b-instruct:free",
    "google/gemma-2-9b-it:free",
    "anthropic/claude-3.5-sonnet",
}

# Global in-memory cache for OpenRouter models list
_openrouter_models_cache = {
    "timestamp": 0.0,
    "data": None
}
_cache_lock = threading.Lock()


@llm_keys_bp.route("/openrouter/models", methods=["GET"])
@require_auth
def list_openrouter_models():
    """Fetch and return OpenRouter models.

    Uses a global in-memory cache to limit requests to once a day.
    Returns curated models and all models with free flags.
    """
    global _openrouter_models_cache

    current_time = time.time()
    day_in_seconds = 86400

    # Thread-safe cache check
    with _cache_lock:
        if (
            not _openrouter_models_cache["data"]
            or (current_time - _openrouter_models_cache["timestamp"]) > day_in_seconds
        ):
            try:
                logger.info("Fetching model list from OpenRouter API")
                response = requests.get("https://openrouter.ai/api/v1/models", timeout=15)
                response.raise_for_status()
                models_data = response.json().get("data", [])
                
                # Transform models into response format
                all_models = []
                curated_models = []

                for model in models_data:
                    model_id = model.get("id")
                    name = model.get("name", model_id)
                    pricing = model.get("pricing", {})
                    
                    try:
                        # Check pricing strings/numbers
                        is_free = (
                            float(pricing.get("prompt", 0)) == 0.0
                            and float(pricing.get("completion", 0)) == 0.0
                        )
                    except (ValueError, TypeError):
                        is_free = False

                    model_info = {
                        "id": model_id,
                        "name": name,
                        "is_free": is_free
                    }

                    all_models.append(model_info)
                    if model_id in _CURATED_MODEL_IDS:
                        curated_models.append(model_info)

                # Ensure curated list isn't empty even if API returned unexpected IDs
                if not curated_models:
                    for cid in _CURATED_MODEL_IDS:
                        curated_models.append({
                            "id": cid,
                            "name": cid.split("/")[-1].replace("-", " ").title(),
                            "is_free": cid.endswith(":free")
                        })

                # Sort by name
                all_models.sort(key=lambda m: m["name"].lower())
                curated_models.sort(key=lambda m: m["name"].lower())

                _openrouter_models_cache = {
                    "timestamp": current_time,
                    "data": {
                        "curated": curated_models,
                        "all": all_models
                    }
                }
            except Exception as e:
                logger.error(f"Failed to fetch models from OpenRouter: {e}")
                # Return stale cache if available, else return error
                if _openrouter_models_cache["data"]:
                    return jsonify(_openrouter_models_cache["data"]), 200
                return jsonify({"error": "Failed to fetch OpenRouter models."}), 502

        return jsonify(_openrouter_models_cache["data"]), 200


@llm_keys_bp.route("", methods=["POST"])
@require_auth
def save_key():
    """Save or update an LLM API key.

    Request body:
    {
        "provider": "gemini",
        "api_key": "your-api-key-here",
        "model_id": "optional-model-id"
    }

    The key is encrypted before storage and never returned in full.

    Returns:
        JSON with provider, masked key, and supported status.
    """
    data = request.get_json(silent=True) or {}
    provider = data.get("provider", "").lower().strip()
    api_key = data.get("api_key", "").strip()
    model_id = data.get("model_id")

    if not provider or provider not in _VALID_PROVIDERS:
        return jsonify({
            "error": f"Invalid provider. Must be one of: {', '.join(sorted(_VALID_PROVIDERS))}"
        }), 400

    if not api_key or len(api_key) < 8:
        return jsonify({"error": "API key is required and must be at least 8 characters."}), 400

    # Validation rules for model_id
    if provider == "openrouter":
        if not model_id or not isinstance(model_id, str) or not model_id.strip():
            return jsonify({"error": "model_id is required when provider is openrouter."}), 400
        model_id = model_id.strip()
    else:
        if model_id is not None:
            return jsonify({"error": f"model_id cannot be configured when provider is {provider}."}), 400

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
                "model_id": model_id,
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
        "model_id": model_id,
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
        .select("provider, key_last_four, model_id, created_at")
        .eq("user_id", g.user_id)
        .execute()
    )

    keys = []
    supported_providers = get_supported_providers()

    for row in result.data:
        keys.append({
            "provider": row["provider"],
            "key_hint": f"****{row['key_last_four']}",
            "model_id": row.get("model_id"),
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
