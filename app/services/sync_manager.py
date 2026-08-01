"""
Background sync orchestration.

Manages backfill and incremental sync jobs using a thread pool.
Tracks job progress in memory for status polling.

NOTE: In-memory state doesn't survive server restarts. For production,
swap the job tracker dict for Redis or a database table.
"""

import uuid
import logging
import threading
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

from app.services import gmail as gmail_service
from app.services.extraction import run_extraction_pipeline
from app.services.encryption import decrypt
from app.db.client import get_service_client

logger = logging.getLogger(__name__)

# Thread pool for background jobs
_executor = ThreadPoolExecutor(max_workers=3)

# In-memory job tracker: {job_id: {status, total, processed, errors, ...}}
_jobs = {}
_jobs_lock = threading.Lock()

# Track active jobs per user to prevent duplicate syncs
_user_jobs = {}  # {user_id: job_id}
_user_jobs_lock = threading.Lock()


def start_backfill(
    user_id: str,
    start_date: Optional[str] = None,
    sender_filter: Optional[str] = None,
    keywords: Optional[list] = None,
    app=None,
) -> dict:
    """Start a background backfill job for a user.

    Args:
        user_id: The user's UUID.
        start_date: ISO date string to search from (YYYY-MM-DD).
        sender_filter: Optional sender email to filter by.
        keywords: Optional list of subject keywords.
        app: Flask application instance (for app context in background thread).

    Returns:
        Dict with 'job_id' and 'status'.
    """
    # Check if user already has a running job
    with _user_jobs_lock:
        existing_job = _user_jobs.get(user_id)
        if existing_job:
            with _jobs_lock:
                job = _jobs.get(existing_job, {})
                if job.get("status") == "processing":
                    return {
                        "job_id": existing_job,
                        "status": "already_running",
                        "message": "A sync job is already running for this user.",
                    }

    job_id = str(uuid.uuid4())

    with _jobs_lock:
        _jobs[job_id] = {
            "job_id": job_id,
            "user_id": user_id,
            "type": "backfill",
            "status": "processing",
            "total": 0,
            "processed": 0,
            "extracted": 0,
            "filtered": 0,
            "errors": 0,
            "error_details": [],
            "started_at": datetime.now(timezone.utc).isoformat(),
            "completed_at": None,
        }

    with _user_jobs_lock:
        _user_jobs[user_id] = job_id

    # Submit to thread pool
    _executor.submit(
        _run_backfill,
        job_id,
        user_id,
        start_date,
        sender_filter,
        keywords,
        app,
    )

    return {"job_id": job_id, "status": "processing"}


def run_incremental_sync(user_id: str, app=None) -> dict:
    """Start a background incremental sync job for a user.

    Uses the stored Gmail historyId to fetch only new messages.

    Args:
        user_id: The user's UUID.
        app: Flask application instance.

    Returns:
        Dict with 'job_id' and 'status'.
    """
    # Check for existing running job
    with _user_jobs_lock:
        existing_job = _user_jobs.get(user_id)
        if existing_job:
            with _jobs_lock:
                job = _jobs.get(existing_job, {})
                if job.get("status") == "processing":
                    return {
                        "job_id": existing_job,
                        "status": "already_running",
                        "message": "A sync job is already running for this user.",
                    }

    job_id = str(uuid.uuid4())

    with _jobs_lock:
        _jobs[job_id] = {
            "job_id": job_id,
            "user_id": user_id,
            "type": "incremental",
            "status": "processing",
            "total": 0,
            "processed": 0,
            "extracted": 0,
            "filtered": 0,
            "errors": 0,
            "error_details": [],
            "started_at": datetime.now(timezone.utc).isoformat(),
            "completed_at": None,
        }

    with _user_jobs_lock:
        _user_jobs[user_id] = job_id

    _executor.submit(_run_incremental, job_id, user_id, app)

    return {"job_id": job_id, "status": "processing"}


def get_job_status(job_id: str) -> Optional[dict]:
    """Get the current status of a sync job.

    Args:
        job_id: The job UUID.

    Returns:
        Job status dict, or None if not found.
    """
    with _jobs_lock:
        job = _jobs.get(job_id)
        if job:
            # Return a copy without internal details
            return {
                "job_id": job["job_id"],
                "type": job["type"],
                "status": job["status"],
                "total": job["total"],
                "processed": job["processed"],
                "extracted": job["extracted"],
                "filtered": job["filtered"],
                "errors": job["errors"],
                "started_at": job["started_at"],
                "completed_at": job["completed_at"],
            }
    return None


def get_user_latest_job(user_id: str) -> Optional[dict]:
    """Get the latest job status for a user.

    Args:
        user_id: The user's UUID.

    Returns:
        Job status dict, or None if no jobs found.
    """
    with _user_jobs_lock:
        job_id = _user_jobs.get(user_id)

    if job_id:
        return get_job_status(job_id)
    return None


# =============================================================================
# Internal workers
# =============================================================================


def _update_job(job_id: str, **kwargs):
    """Thread-safe update of job status fields."""
    with _jobs_lock:
        if job_id in _jobs:
            _jobs[job_id].update(kwargs)


def _run_backfill(
    job_id: str,
    user_id: str,
    start_date: Optional[str],
    sender_filter: Optional[str],
    keywords: Optional[list],
    app=None,
):
    """Background worker for backfill sync.

    Fetches matching emails, runs extraction pipeline, stores results.
    """
    try:
        # Use app context if provided (needed for Flask extensions)
        ctx = app.app_context() if app else _nullcontext()
        with ctx:
            _do_backfill(job_id, user_id, start_date, sender_filter, keywords)
    except Exception as e:
        logger.exception(f"Backfill job {job_id} failed: {e}")
        _update_job(
            job_id,
            status="failed",
            completed_at=datetime.now(timezone.utc).isoformat(),
        )


def _do_backfill(
    job_id: str,
    user_id: str,
    start_date: Optional[str],
    sender_filter: Optional[str],
    keywords: Optional[list],
):
    """Core backfill logic."""
    from app.config import Config

    supabase = get_service_client()

    # 1. Fetch the user's encrypted refresh token
    conn_result = (
        supabase.table("email_connections")
        .select("encrypted_refresh_token")
        .eq("user_id", user_id)
        .execute()
    )

    if not conn_result.data:
        _update_job(job_id, status="failed", completed_at=datetime.now(timezone.utc).isoformat())
        logger.error(f"No email connection found for user {user_id}")
        return

    encrypted_token = conn_result.data[0]["encrypted_refresh_token"]
    refresh_token = decrypt(encrypted_token)

    # 2. Build Gmail service and search query
    service = gmail_service.build_gmail_service(refresh_token)

    if not keywords:
        keywords = Config.PLACEMENT_KEYWORDS

    query = gmail_service.build_search_query(
        start_date=start_date,
        sender_filter=sender_filter,
        keywords=keywords,
    )

    logger.info(f"Backfill search query: {query}")

    # 3. Search for matching messages
    messages = gmail_service.search_messages(service, query)
    total = len(messages)
    _update_job(job_id, total=total)

    logger.info(f"Found {total} messages to process for user {user_id}")

    if total == 0:
        _update_job(
            job_id,
            status="completed",
            completed_at=datetime.now(timezone.utc).isoformat(),
        )
        return

    # 4. Get user's LLM key (if available)
    api_key, provider = _get_user_llm_key(supabase, user_id)

    # 5. Process each message
    for i, msg_ref in enumerate(messages):
        try:
            msg = gmail_service.get_message(service, msg_ref["id"])

            result = run_extraction_pipeline(
                email_body=msg["body"],
                subject=msg["subject"],
                sender=msg["sender_email"],
                api_key=api_key,
                provider=provider,
            )

            if result is None:
                # Filtered out
                _update_job(
                    job_id,
                    processed=i + 1,
                    filtered=_jobs[job_id]["filtered"] + 1,
                )
                continue

            # Upsert opportunity into database
            _upsert_opportunity(supabase, user_id, msg_ref["id"], result)

            _update_job(
                job_id,
                processed=i + 1,
                extracted=_jobs[job_id]["extracted"] + 1,
            )

        except Exception as e:
            logger.error(f"Error processing message {msg_ref['id']}: {e}")
            with _jobs_lock:
                _jobs[job_id]["errors"] += 1
                _jobs[job_id]["error_details"].append(
                    {"message_id": msg_ref["id"], "error": str(e)}
                )
                _jobs[job_id]["processed"] = i + 1

    # 6. Store the current historyId for future incremental sync
    try:
        history_id = gmail_service.get_current_history_id(service)
        supabase.table("email_connections").update(
            {
                "gmail_history_id": history_id,
                "last_synced_at": datetime.now(timezone.utc).isoformat(),
            }
        ).eq("user_id", user_id).execute()
    except Exception as e:
        logger.error(f"Failed to update history ID: {e}")

    _update_job(
        job_id,
        status="completed",
        completed_at=datetime.now(timezone.utc).isoformat(),
    )

    logger.info(
        f"Backfill completed for user {user_id}: "
        f"{_jobs[job_id]['extracted']} extracted, "
        f"{_jobs[job_id]['filtered']} filtered, "
        f"{_jobs[job_id]['errors']} errors"
    )


def _run_incremental(job_id: str, user_id: str, app=None):
    """Background worker for incremental sync."""
    try:
        ctx = app.app_context() if app else _nullcontext()
        with ctx:
            _do_incremental(job_id, user_id)
    except Exception as e:
        logger.exception(f"Incremental sync job {job_id} failed: {e}")
        _update_job(
            job_id,
            status="failed",
            completed_at=datetime.now(timezone.utc).isoformat(),
        )


def _do_incremental(job_id: str, user_id: str):
    """Core incremental sync logic."""
    supabase = get_service_client()

    # 1. Fetch connection data
    conn_result = (
        supabase.table("email_connections")
        .select("encrypted_refresh_token, gmail_history_id")
        .eq("user_id", user_id)
        .execute()
    )

    if not conn_result.data:
        _update_job(job_id, status="failed", completed_at=datetime.now(timezone.utc).isoformat())
        logger.error(f"No email connection found for user {user_id}")
        return

    conn = conn_result.data[0]
    history_id = conn.get("gmail_history_id")

    if not history_id:
        logger.warning(f"No history ID stored for user {user_id} — need to run backfill first")
        _update_job(
            job_id,
            status="failed",
            completed_at=datetime.now(timezone.utc).isoformat(),
        )
        return

    refresh_token = decrypt(conn["encrypted_refresh_token"])
    service = gmail_service.build_gmail_service(refresh_token)

    # 2. Get new messages since last sync
    history = gmail_service.get_history(service, history_id)
    new_message_ids = history["message_ids"]
    total = len(new_message_ids)
    _update_job(job_id, total=total)

    logger.info(f"Incremental sync found {total} new messages for user {user_id}")

    if total == 0:
        _update_job(
            job_id,
            status="completed",
            completed_at=datetime.now(timezone.utc).isoformat(),
        )
        # Still update the history ID
        supabase.table("email_connections").update(
            {
                "gmail_history_id": history["history_id"],
                "last_synced_at": datetime.now(timezone.utc).isoformat(),
            }
        ).eq("user_id", user_id).execute()
        return

    # 3. Get user's LLM key
    api_key, provider = _get_user_llm_key(supabase, user_id)

    # 4. Process each new message
    for i, msg_id in enumerate(new_message_ids):
        try:
            msg = gmail_service.get_message(service, msg_id)

            result = run_extraction_pipeline(
                email_body=msg["body"],
                subject=msg["subject"],
                sender=msg["sender_email"],
                api_key=api_key,
                provider=provider,
            )

            if result is None:
                _update_job(
                    job_id,
                    processed=i + 1,
                    filtered=_jobs[job_id]["filtered"] + 1,
                )
                continue

            _upsert_opportunity(supabase, user_id, msg_id, result)
            _update_job(
                job_id,
                processed=i + 1,
                extracted=_jobs[job_id]["extracted"] + 1,
            )

        except Exception as e:
            logger.error(f"Error processing message {msg_id}: {e}")
            with _jobs_lock:
                _jobs[job_id]["errors"] += 1
                _jobs[job_id]["processed"] = i + 1

    # 5. Update history ID
    supabase.table("email_connections").update(
        {
            "gmail_history_id": history["history_id"],
            "last_synced_at": datetime.now(timezone.utc).isoformat(),
        }
    ).eq("user_id", user_id).execute()

    _update_job(
        job_id,
        status="completed",
        completed_at=datetime.now(timezone.utc).isoformat(),
    )


# =============================================================================
# Helpers
# =============================================================================


def _get_user_llm_key(supabase, user_id: str) -> tuple:
    """Fetch and decrypt the user's LLM API key.

    Returns:
        Tuple of (decrypted_api_key, provider). Both are None if no key found.
    """
    key_result = (
        supabase.table("llm_keys")
        .select("encrypted_api_key, provider")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )

    if key_result.data:
        key_data = key_result.data[0]
        try:
            api_key = decrypt(key_data["encrypted_api_key"])
            return api_key, key_data["provider"]
        except Exception as e:
            logger.error(f"Failed to decrypt LLM key for user {user_id}: {e}")

    return None, "gemini"


def _upsert_opportunity(supabase, user_id: str, message_id: str, result: dict):
    """Insert or update an opportunity in the database.

    Uses the unique constraint on (user_id, raw_email_ref) to handle
    duplicate emails gracefully via upsert.
    """
    opportunity = {
        "user_id": user_id,
        "company": result.get("company"),
        "role": result.get("role"),
        "role_type": result.get("role_type", "unclear"),
        "salary_or_stipend": result.get("salary_or_stipend"),
        "bond": result.get("bond"),
        "last_date": result.get("last_date"),
        "register_links": result.get("register_links", []),
        "raw_email_ref": message_id,
        "extraction_method": result.get("extraction_method", "regex"),
    }

    supabase.table("opportunities").upsert(
        opportunity,
        on_conflict="user_id,raw_email_ref",
    ).execute()


class _nullcontext:
    """Minimal context manager for when no app context is needed."""
    def __enter__(self):
        return self
    def __exit__(self, *args):
        pass
