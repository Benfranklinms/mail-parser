"""
Gmail OAuth and message fetching service.

Handles the Google OAuth flow for Gmail readonly access, and provides
functions to search, fetch, and incrementally sync messages.
"""

import os
import base64
import logging
from email.utils import parseaddr
from typing import Optional

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build

logger = logging.getLogger(__name__)

# Gmail API scopes — readonly access only
SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]


def _get_client_config() -> dict:
    """Build the OAuth client config dict from environment variables.

    Returns:
        Client config dict in the format expected by google_auth_oauthlib.
    """
    return {
        "web": {
            "client_id": os.environ.get("GOOGLE_CLIENT_ID"),
            "client_secret": os.environ.get("GOOGLE_CLIENT_SECRET"),
            "redirect_uris": [os.environ.get("GOOGLE_REDIRECT_URI")],
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    }


def get_auth_url(state: Optional[str] = None) -> str:
    """Generate the Google OAuth consent URL for Gmail readonly access.

    Args:
        state: Optional opaque string to pass through the OAuth flow
               (used to carry user_id through the callback).

    Returns:
        The authorization URL the user should be redirected to.
    """
    flow = Flow.from_client_config(
        _get_client_config(),
        scopes=SCOPES,
        redirect_uri=os.environ.get("GOOGLE_REDIRECT_URI"),
        autogenerate_code_verifier=False,
    )

    auth_url, _ = flow.authorization_url(
        access_type="offline",       # Get a refresh token
        include_granted_scopes="true",
        prompt="consent",            # Always show consent to ensure refresh token
        state=state,
    )

    return auth_url


def exchange_code(code: str) -> dict:
    """Exchange an authorization code for OAuth tokens.

    Args:
        code: The authorization code from the OAuth callback.

    Returns:
        Dict with 'access_token', 'refresh_token', and 'token' (full token JSON).
    """
    flow = Flow.from_client_config(
        _get_client_config(),
        scopes=SCOPES,
        redirect_uri=os.environ.get("GOOGLE_REDIRECT_URI"),
        autogenerate_code_verifier=False,
    )

    flow.fetch_token(code=code)
    credentials = flow.credentials

    return {
        "access_token": credentials.token,
        "refresh_token": credentials.refresh_token,
        "token_uri": credentials.token_uri,
        "client_id": credentials.client_id,
        "client_secret": credentials.client_secret,
    }


def build_gmail_service(refresh_token: str):
    """Create an authenticated Gmail API service from a refresh token.

    Args:
        refresh_token: The decrypted OAuth refresh token.

    Returns:
        A Gmail API service resource.
    """
    credentials = Credentials(
        token=None,  # Will be refreshed automatically
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.environ.get("GOOGLE_CLIENT_ID"),
        client_secret=os.environ.get("GOOGLE_CLIENT_SECRET"),
    )

    return build("gmail", "v1", credentials=credentials, cache_discovery=False)


def build_search_query(
    start_date: Optional[str] = None,
    sender_filter: Optional[str] = None,
    keywords: Optional[list] = None,
) -> str:
    """Build a Gmail search query string for placement-related emails.

    Args:
        start_date: ISO date string (YYYY-MM-DD) to search from.
        sender_filter: Specific sender email to filter by.
        keywords: List of subject keywords to match.

    Returns:
        Gmail search query string.
    """
    parts = []

    if start_date:
        # Gmail uses YYYY/MM/DD format
        formatted_date = start_date.replace("-", "/")
        parts.append(f"after:{formatted_date}")

    if sender_filter:
        parts.append(f"from:{sender_filter}")

    if keywords:
        # Search keywords across subject and body
        keyword_query = " OR ".join(kw for kw in keywords)
        parts.append(f"({keyword_query})")

    return " ".join(parts)


def search_messages(service, query: str, max_results: int = 500) -> list:
    """Search Gmail for messages matching a query.

    Handles pagination to collect all matching message IDs up to max_results.

    Args:
        service: Authenticated Gmail API service.
        query: Gmail search query string.
        max_results: Maximum number of messages to return.

    Returns:
        List of message dicts with 'id' and 'threadId'.
    """
    messages = []
    page_token = None

    while len(messages) < max_results:
        batch_size = min(100, max_results - len(messages))

        result = (
            service.users()
            .messages()
            .list(
                userId="me",
                q=query,
                maxResults=batch_size,
                pageToken=page_token,
            )
            .execute()
        )

        batch_messages = result.get("messages", [])
        if not batch_messages:
            break

        messages.extend(batch_messages)
        page_token = result.get("nextPageToken")

        if not page_token:
            break

    return messages[:max_results]


def get_message(service, message_id: str) -> dict:
    """Fetch a single Gmail message and extract its useful parts.

    Args:
        service: Authenticated Gmail API service.
        message_id: The Gmail message ID.

    Returns:
        Dict with 'id', 'subject', 'sender', 'sender_email', 'body', 'date'.
    """
    msg = (
        service.users()
        .messages()
        .get(userId="me", id=message_id, format="full")
        .execute()
    )

    headers = msg.get("payload", {}).get("headers", [])
    header_map = {h["name"].lower(): h["value"] for h in headers}

    subject = header_map.get("subject", "")
    sender = header_map.get("from", "")
    date = header_map.get("date", "")

    # Extract just the email address from the sender
    _, sender_email = parseaddr(sender)

    # Extract body text
    body = _extract_body(msg.get("payload", {}))

    return {
        "id": message_id,
        "subject": subject,
        "sender": sender,
        "sender_email": sender_email,
        "body": body,
        "date": date,
    }


def _extract_body(payload: dict) -> str:
    """Recursively extract the text body from a Gmail message payload.

    Prefers text/plain, falls back to text/html.

    Args:
        payload: The message payload from the Gmail API.

    Returns:
        The decoded body text.
    """
    body_text = ""

    mime_type = payload.get("mimeType", "")

    # Simple single-part message
    if mime_type in ("text/plain", "text/html"):
        data = payload.get("body", {}).get("data", "")
        if data:
            body_text = base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")
        return body_text

    # Multipart message — recurse into parts
    parts = payload.get("parts", [])

    # First pass: look for text/plain
    for part in parts:
        part_mime = part.get("mimeType", "")
        if part_mime == "text/plain":
            data = part.get("body", {}).get("data", "")
            if data:
                return base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")

        # Recurse into nested multipart
        if part_mime.startswith("multipart/"):
            nested = _extract_body(part)
            if nested:
                return nested

    # Second pass: fall back to text/html
    for part in parts:
        part_mime = part.get("mimeType", "")
        if part_mime == "text/html":
            data = part.get("body", {}).get("data", "")
            if data:
                return base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")

    return body_text


def get_history(service, history_id: str) -> dict:
    """Fetch new message IDs since the given history ID.

    Args:
        service: Authenticated Gmail API service.
        history_id: The last known Gmail historyId.

    Returns:
        Dict with 'message_ids' (list of new message IDs) and
        'history_id' (the latest historyId to store for next sync).
    """
    message_ids = []
    page_token = None
    latest_history_id = history_id

    try:
        while True:
            result = (
                service.users()
                .history()
                .list(
                    userId="me",
                    startHistoryId=history_id,
                    historyTypes=["messageAdded"],
                    pageToken=page_token,
                )
                .execute()
            )

            latest_history_id = result.get("historyId", latest_history_id)

            for record in result.get("history", []):
                for msg_added in record.get("messagesAdded", []):
                    msg_id = msg_added.get("message", {}).get("id")
                    if msg_id:
                        message_ids.append(msg_id)

            page_token = result.get("nextPageToken")
            if not page_token:
                break

    except Exception as e:
        # If historyId is stale (404), caller should do a full re-sync
        logger.error(f"Gmail history.list failed: {e}")
        raise

    return {
        "message_ids": list(set(message_ids)),  # Deduplicate
        "history_id": latest_history_id,
    }


def get_current_history_id(service) -> str:
    """Get the current historyId from the user's Gmail profile.

    Used to initialize the historyId after the first backfill.

    Args:
        service: Authenticated Gmail API service.

    Returns:
        The current historyId as a string.
    """
    profile = service.users().getProfile(userId="me").execute()
    return str(profile.get("historyId", ""))
