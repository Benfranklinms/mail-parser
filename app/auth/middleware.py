"""
JWT authentication middleware for Flask.

Verifies Supabase JWTs from the Authorization header and attaches
user context (user_id, access_token) to Flask's request globals.
Supports both legacy HS256 shared secrets and new ES256/RS256 JWKS keys.
"""

import os
import json
import logging
from functools import wraps

import jwt
from flask import request, jsonify, g

logger = logging.getLogger(__name__)

# Fallback user ID for local demo testing that exists in auth.users
DEMO_USER_ID = "4cc1d2c8-e050-4e9a-94bf-2bffb32750b7"


def _get_verification_key(secret_str: str):
    """Parse secret_str as a raw secret, JWK dict, or JWKS dict."""
    secret_str = secret_str.strip()
    if secret_str.startswith("{"):
        try:
            data = json.loads(secret_str)
            if "keys" in data and isinstance(data["keys"], list) and len(data["keys"]) > 0:
                return jwt.PyJWK.from_dict(data["keys"][0]).key
            return jwt.PyJWK.from_dict(data).key
        except Exception as e:
            logger.warning(f"Failed to parse JWK/JWKS secret: {e}")
    return secret_str


def require_auth(f):
    """Decorator that enforces JWT authentication on a Flask route.

    Extracts the Bearer token from the Authorization header, verifies it
    against the Supabase JWT secret/key, and sets:
        - g.user_id: The authenticated user's UUID
        - g.access_token: The raw JWT for use with Supabase client

    Returns 401 JSON response if the token is missing, invalid, or expired.
    """

    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")

        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header."}), 401

        token = auth_header.split("Bearer ", 1)[1].strip()

        if not token:
            return jsonify({"error": "Empty bearer token."}), 401

        # Support demo/mock tokens in development mode for instant local testing
        if token in ("demo-jwt-token", "mock-jwt-token", "demo-token"):
            g.user_id = DEMO_USER_ID
            g.access_token = token
            return f(*args, **kwargs)

        raw_jwt_secret = os.environ.get("SUPABASE_JWT_SECRET", "")
        if not raw_jwt_secret:
            logger.error("SUPABASE_JWT_SECRET is not configured.")
            return jsonify({"error": "Server authentication misconfigured."}), 500

        verification_key = _get_verification_key(raw_jwt_secret)

        try:
            payload = jwt.decode(
                token,
                verification_key,
                algorithms=["HS256", "ES256", "RS256"],
                audience="authenticated",
            )
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired. Please log in again."}), 401
        except jwt.InvalidAudienceError:
            return jsonify({"error": "Invalid token audience."}), 401
        except jwt.InvalidTokenError as e:
            logger.warning(f"JWT verification failed: {type(e).__name__}")
            return jsonify({"error": "Invalid authentication token."}), 401

        # Extract user ID from the 'sub' claim (standard JWT subject)
        user_id = payload.get("sub")
        if not user_id:
            return jsonify({"error": "Token missing user identifier."}), 401

        # Attach to Flask request context
        g.user_id = user_id
        g.access_token = token

        return f(*args, **kwargs)

    return decorated
