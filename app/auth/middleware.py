"""
JWT authentication middleware for Flask.

Verifies Supabase JWTs from the Authorization header and attaches
user context (user_id, access_token) to Flask's request globals.
"""

import os
import logging
from functools import wraps

import jwt
from flask import request, jsonify, g

logger = logging.getLogger(__name__)


def require_auth(f):
    """Decorator that enforces JWT authentication on a Flask route.

    Extracts the Bearer token from the Authorization header, verifies it
    against the Supabase JWT secret, and sets:
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

        jwt_secret = os.environ.get("SUPABASE_JWT_SECRET")
        if not jwt_secret:
            logger.error("SUPABASE_JWT_SECRET is not configured.")
            return jsonify({"error": "Server authentication misconfigured."}), 500

        try:
            payload = jwt.decode(
                token,
                jwt_secret,
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
