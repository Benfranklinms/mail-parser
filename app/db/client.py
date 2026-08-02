"""
Supabase client wrapper.

Provides two client constructors:
- get_client(access_token): RLS-respecting client using the user's JWT
- get_service_client(): Service role client for background jobs (bypasses RLS)
"""

import os
from supabase import create_client, Client


def get_client(access_token: str) -> Client:
    """Create a Supabase client authenticated with the user's JWT.

    This client respects Row Level Security — queries will only return
    rows belonging to the authenticated user.

    If access_token is a mock/demo token (not a 3-part JWT), falls back to
    service_role client for local development and testing.

    Args:
        access_token: The user's Supabase JWT (from the Authorization header).

    Returns:
        An authenticated Supabase client.
    """
    url = os.environ.get("SUPABASE_URL")
    anon_key = os.environ.get("SUPABASE_ANON_KEY")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not anon_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_ANON_KEY must be set.")

    # If token is not a valid 3-part JWT (e.g. demo-jwt-token in local dev), use service client
    if not access_token or access_token.count(".") != 2:
        if service_key:
            return create_client(url, service_key)

    client = create_client(url, anon_key)
    client.postgrest.auth(access_token)
    return client


def get_service_client() -> Client:
    """Create a Supabase client with service role access.

    WARNING: This client bypasses RLS. Use ONLY in background jobs,
    and always scope queries with WHERE user_id = <target_user_id>.

    Returns:
        A service-role Supabase client.
    """
    url = os.environ.get("SUPABASE_URL")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not service_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.")

    return create_client(url, service_key)
