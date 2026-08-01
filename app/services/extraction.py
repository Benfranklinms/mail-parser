"""
Hybrid extraction pipeline — pre-filter, regex pass, LLM fallback.

Three-stage pipeline for extracting structured placement opportunity
data from email bodies:

1. Pre-filter: Confirm the email is actually a placement opportunity
2. Regex pass: Extract salary, dates, and links using patterns (free, fast)
3. LLM fallback: Use the user's LLM provider for fields regex couldn't get

The merge step combines results, preferring regex for structured data
and LLM for natural-language fields.
"""

import re
import logging
from typing import Optional
from dateutil import parser as date_parser

from app.services.llm_providers import extract_with_llm, EMPTY_RESULT

logger = logging.getLogger(__name__)

# =============================================================================
# Stage 1: Pre-filter
# =============================================================================

# Keywords that indicate a placement/internship opportunity
_PLACEMENT_KEYWORDS = [
    r"placement",
    r"internship",
    r"hiring",
    r"recruitment",
    r"job\s*opportunity",
    r"campus\s*drive",
    r"walk[\s-]*in",
    r"off[\s-]*campus",
    r"on[\s-]*campus",
    r"job\s*opening",
    r"career\s*opportunity",
    r"openings?\s*for",
    r"ctc",
    r"stipend",
    r"package",
    r"lpa",
    r"eligible\s*branches",
    r"eligible\s*students",
    r"registration\s*link",
    r"apply\s*(now|here|before|by)",
    r"last\s*date",
    r"deadline",
]

# Keywords that indicate the email is NOT a placement opportunity
_NEGATIVE_KEYWORDS = [
    r"newsletter",
    r"unsubscribe",
    r"weekly\s*digest",
    r"monthly\s*update",
    r"holiday\s*notice",
    r"exam\s*schedule",
    r"fee\s*payment",
    r"hostel",
    r"library",
    r"attendance",
]

_PLACEMENT_PATTERN = re.compile(
    "|".join(_PLACEMENT_KEYWORDS), re.IGNORECASE
)
_NEGATIVE_PATTERN = re.compile(
    "|".join(_NEGATIVE_KEYWORDS), re.IGNORECASE
)


def pre_filter(subject: str, sender: str, body: str) -> bool:
    """Check if an email looks like a placement opportunity.

    Args:
        subject: Email subject line.
        sender: Sender email address or display name.
        body: Email body text.

    Returns:
        True if the email appears to be a placement opportunity.
    """
    combined_text = f"{subject} {body[:2000]}"  # Check first 2000 chars of body

    # Check for placement-positive keywords
    positive_matches = len(_PLACEMENT_PATTERN.findall(combined_text))

    # Check for negative keywords
    negative_matches = len(_NEGATIVE_PATTERN.findall(combined_text))

    # Need at least 1 positive keyword and positive should outweigh negative
    if positive_matches == 0:
        return False

    if negative_matches > positive_matches:
        return False

    return True


# =============================================================================
# Stage 2: Regex extraction
# =============================================================================

# --- Salary / Stipend patterns ---

_SALARY_PATTERNS = [
    # CTC patterns: "6 LPA", "6.5 LPA", "6 lakhs", "₹6 LPA"
    re.compile(
        r"(?:ctc|salary|package|compensation)[\s:]*(?:(?:rs\.?|₹|inr)\s*)?(\d+(?:\.\d+)?)\s*(?:lpa|lakhs?|l(?:akh)?)\s*(?:per\s*annum)?",
        re.IGNORECASE,
    ),
    # Standalone LPA: "6 LPA", "6.5LPA"
    re.compile(
        r"(?:rs\.?|₹|inr)?\s*(\d+(?:\.\d+)?)\s*(?:lpa|lakhs?\s*per\s*annum)",
        re.IGNORECASE,
    ),
    # Indian number format: "6,00,000" or "₹6,00,000"
    re.compile(
        r"(?:ctc|salary|package)[\s:]*(?:rs\.?|₹|inr)\s*(\d{1,3}(?:,\d{2})*(?:,\d{3})?)",
        re.IGNORECASE,
    ),
    # Stipend per month: "₹25,000/month", "25000 per month"
    re.compile(
        r"(?:stipend|salary)[\s:]*(?:rs\.?|₹|inr)?\s*(\d[\d,]*)\s*(?:/\s*month|per\s*month|p\.?m\.?|monthly)",
        re.IGNORECASE,
    ),
    # Simple stipend: "Stipend: ₹25,000"
    re.compile(
        r"stipend[\s:]+(?:rs\.?|₹|inr)?\s*(\d[\d,]*)",
        re.IGNORECASE,
    ),
    # "unpaid" internship
    re.compile(
        r"\b(unpaid)\b",
        re.IGNORECASE,
    ),
]

# --- Date patterns ---

_DATE_CONTEXT_PATTERNS = [
    # "Last date: 25/12/2025", "Deadline: 25-12-2025", "Last date to register: 25/12/2025"
    re.compile(
        r"(?:last\s*date|deadline|register\s*(?:by|before)|apply\s*(?:by|before)|last\s*day)(?:\s+\w+){0,5}?[\s:]+(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4})",
        re.IGNORECASE,
    ),
    # "Last date: 25 December 2025", "Deadline: Dec 25, 2025"
    re.compile(
        r"(?:last\s*date|deadline|register\s*(?:by|before)|apply\s*(?:by|before)|last\s*day)(?:\s+\w+){0,5}?[\s:]+(\d{1,2}\s*(?:st|nd|rd|th)?\s*(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*(?:,?\s*\d{2,4})?)",
        re.IGNORECASE,
    ),
    # "December 25, 2025" or "25 December 2025" with context keyword nearby
    re.compile(
        r"(?:last\s*date|deadline|register\s*(?:by|before)|apply\s*(?:by|before)|last\s*day)(?:\s+\w+){0,5}?[\s:]+(?:(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*\d{1,2}\s*(?:st|nd|rd|th)?\s*,?\s*\d{2,4})",
        re.IGNORECASE,
    ),
]

# Standalone date patterns (lower confidence, used as fallback)
_STANDALONE_DATE_PATTERNS = [
    re.compile(r"\b(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4})\b"),
    re.compile(
        r"\b(\d{1,2}\s*(?:st|nd|rd|th)?\s*(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*(?:,?\s*\d{2,4})?)\b",
        re.IGNORECASE,
    ),
]

# --- Link patterns ---

# High-confidence registration link domains
_REGISTRATION_DOMAINS = [
    r"forms\.gle",
    r"docs\.google\.com/forms",
    r"forms\.google\.com",
    r"greenhouse\.io",
    r"lever\.co",
    r"workday\.com",
    r"naukri\.com",
    r"internshala\.com",
    r"unstop\.com",
    r"dare2compete\.com",
    r"superset\.com",
    r"freshworks\.com",
    r"zoho\.com/recruit",
    r"careers\.",
    r"jobs\.",
    r"apply\.",
    r"hire\.",
]

_REGISTRATION_LINK_PATTERN = re.compile(
    r"https?://(?:" + "|".join(_REGISTRATION_DOMAINS) + r")[^\s<>\"')\]]*",
    re.IGNORECASE,
)

# General URL pattern (fallback — collects ALL links)
_GENERAL_URL_PATTERN = re.compile(
    r"https?://[^\s<>\"')\]]+",
    re.IGNORECASE,
)


def regex_extract(body: str, subject: str = "") -> dict:
    """Extract structured fields from email text using regex patterns.

    Args:
        body: The email body text.
        subject: Optional email subject for additional context.

    Returns:
        Dict with extracted values. None for fields that couldn't be
        confidently extracted.
    """
    combined = f"{subject}\n{body}" if subject else body

    result = {
        "salary_or_stipend": _extract_salary(combined),
        "last_date": _extract_date(combined),
        "register_links": _extract_links(body),
        # Fields below are rarely extractable via regex — left for LLM
        "company": None,
        "role": None,
        "role_type": None,
        "bond": None,
    }

    return result


def _extract_salary(text: str) -> Optional[str]:
    """Extract salary or stipend from text."""
    for pattern in _SALARY_PATTERNS:
        match = pattern.search(text)
        if match:
            # Return the full match context for readability
            matched_text = match.group(0).strip()
            return matched_text

    return None


def _extract_date(text: str) -> Optional[str]:
    """Extract registration deadline date from text."""
    # First try context-aware patterns (higher confidence)
    for pattern in _DATE_CONTEXT_PATTERNS:
        match = pattern.search(text)
        if match:
            date_str = match.group(1).strip()
            # Try to parse and validate the date
            try:
                parsed = date_parser.parse(date_str, fuzzy=True, dayfirst=True)
                return date_str  # Return the original string as found
            except (ValueError, OverflowError):
                return date_str  # Return raw match even if parsing fails

    return None


def _extract_links(text: str) -> list:
    """Extract all registration/application links from text.

    Prioritizes known registration domains, falls back to all URLs.
    Returns deduplicated list.
    """
    # First collect high-confidence registration links
    reg_links = _REGISTRATION_LINK_PATTERN.findall(text)

    # Also collect all URLs
    all_links = _GENERAL_URL_PATTERN.findall(text)

    # Filter out common non-registration URLs
    _EXCLUDED_DOMAINS = [
        "google.com/maps",
        "goo.gl/maps",
        "facebook.com",
        "twitter.com",
        "instagram.com",
        "linkedin.com/company",
        "youtube.com",
        "mailto:",
        "tel:",
        "unsubscribe",
        "privacy-policy",
        "terms-of-service",
    ]

    filtered_links = []
    seen = set()

    # Add registration links first (higher priority)
    for link in reg_links:
        cleaned = link.rstrip(".,;:)")
        if cleaned not in seen:
            seen.add(cleaned)
            filtered_links.append(cleaned)

    # Then add remaining links that aren't excluded
    for link in all_links:
        cleaned = link.rstrip(".,;:)")
        if cleaned in seen:
            continue

        is_excluded = any(excl in cleaned.lower() for excl in _EXCLUDED_DOMAINS)
        if not is_excluded:
            seen.add(cleaned)
            filtered_links.append(cleaned)

    return filtered_links


# =============================================================================
# Stage 3: Merge results
# =============================================================================


def merge_results(regex_result: dict, llm_result: dict) -> dict:
    """Merge regex and LLM extraction results.

    Strategy:
    - Prefer regex for: register_links, last_date, salary_or_stipend
      (regex is more reliable for structured patterns when matched)
    - Prefer LLM for: company, role, role_type, bond
    - Fall back to LLM for any fields regex left as None

    Args:
        regex_result: Output from regex_extract().
        llm_result: Output from extract_with_llm().

    Returns:
        Merged dict with all fields populated where possible.
        Includes 'extraction_method' tag.
    """
    merged = EMPTY_RESULT.copy()

    # LLM-preferred fields
    for field in ["company", "role", "role_type", "bond"]:
        llm_val = llm_result.get(field)
        regex_val = regex_result.get(field)
        merged[field] = llm_val if llm_val is not None else regex_val

    # Regex-preferred fields (only use LLM as fallback)
    for field in ["salary_or_stipend", "last_date"]:
        regex_val = regex_result.get(field)
        llm_val = llm_result.get(field)
        merged[field] = regex_val if regex_val is not None else llm_val

    # Links: merge both sets, deduplicated, regex links first
    regex_links = regex_result.get("register_links", [])
    llm_links = llm_result.get("register_links", [])

    seen = set()
    merged_links = []
    for link in regex_links + llm_links:
        if link not in seen:
            seen.add(link)
            merged_links.append(link)

    merged["register_links"] = merged_links

    # Determine extraction method tag
    regex_contributed = any(
        regex_result.get(f) is not None
        for f in ["salary_or_stipend", "last_date", "register_links"]
        if f != "register_links" or regex_result.get(f)
    )
    llm_contributed = any(
        llm_result.get(f) is not None
        for f in ["company", "role", "role_type", "bond"]
    )

    if regex_contributed and llm_contributed:
        merged["extraction_method"] = "hybrid"
    elif llm_contributed:
        merged["extraction_method"] = "llm"
    else:
        merged["extraction_method"] = "regex"

    return merged


# =============================================================================
# Full pipeline
# =============================================================================


def run_extraction_pipeline(
    email_body: str,
    subject: str,
    sender: str,
    api_key: Optional[str] = None,
    provider: str = "gemini",
    model_id: Optional[str] = None,
) -> Optional[dict]:
    """Run the full extraction pipeline on a single email.

    Args:
        email_body: The email body text.
        subject: The email subject.
        sender: The sender address.
        api_key: Decrypted LLM API key (None to skip LLM stage).
        provider: LLM provider to use.
        model_id: Optional specific model ID for the LLM.

    Returns:
        Extracted opportunity dict, or None if the email was filtered out.
    """
    # Stage 1: Pre-filter
    if not pre_filter(subject, sender, email_body):
        logger.debug(f"Email filtered out: {subject[:50]}")
        return None

    # Stage 2: Regex extraction
    regex_result = regex_extract(email_body, subject)

    # Stage 3: LLM fallback (only if API key is available)
    llm_result = EMPTY_RESULT.copy()

    if api_key:
        # Check which fields still need LLM
        needs_llm = (
            regex_result.get("company") is None
            or regex_result.get("role") is None
            or regex_result.get("role_type") is None
            or regex_result.get("bond") is None
        )

        if needs_llm:
            logger.debug("Running LLM extraction for remaining fields")
            llm_result = extract_with_llm(
                email_body, api_key, provider, subject, model_id
            )
    else:
        logger.debug("No LLM API key — skipping LLM extraction")

    # Merge results
    merged = merge_results(regex_result, llm_result)

    return merged
