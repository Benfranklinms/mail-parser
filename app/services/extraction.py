"""
Hybrid extraction pipeline — pre-filter, regex pass, LLM fallback.

Three-stage pipeline for extracting structured placement opportunity
data from email bodies:

1. Pre-filter: Confirm the email is actually a placement opportunity
2. Regex pass: Extract salary, dates, links, company, role, and role_type
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
    """Check if an email looks like a placement opportunity."""
    combined_text = f"{subject} {body[:2000]}"

    positive_matches = len(_PLACEMENT_PATTERN.findall(combined_text))
    negative_matches = len(_NEGATIVE_PATTERN.findall(combined_text))

    if positive_matches == 0:
        return False

    if negative_matches > positive_matches:
        return False

    return True


# =============================================================================
# Stage 2: Regex extraction
# =============================================================================

_SALARY_PATTERNS = [
    re.compile(
        r"(?:ctc|salary|package|compensation)[\s:]*(?:(?:rs\.?|₹|inr)\s*)?(\d+(?:\.\d+)?)\s*(?:lpa|lakhs?|l(?:akh)?)\s*(?:per\s*annum)?",
        re.IGNORECASE,
    ),
    re.compile(
        r"(?:rs\.?|₹|inr)?\s*(\d+(?:\.\d+)?)\s*(?:lpa|lakhs?\s*per\s*annum|lpa)",
        re.IGNORECASE,
    ),
    re.compile(
        r"(?:ctc|salary|package)[\s:]*(?:rs\.?|₹|inr)\s*(\d{1,3}(?:,\d{2})*(?:,\d{3})?)",
        re.IGNORECASE,
    ),
    re.compile(
        r"(?:stipend|salary)[\s:]*(?:rs\.?|₹|inr)?\s*(\d[\d,]*)\s*(?:/\s*month|per\s*month|p\.?m\.?|monthly)",
        re.IGNORECASE,
    ),
    re.compile(
        r"stipend[\s:]+(?:rs\.?|₹|inr)?\s*(\d[\d,]*)",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(unpaid)\b",
        re.IGNORECASE,
    ),
]

_DATE_CONTEXT_PATTERNS = [
    re.compile(
        r"(?:last\s*date|deadline|register\s*(?:by|before)|apply\s*(?:by|before)|last\s*day)(?:\s+\w+){0,5}?[\s:]+(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4})",
        re.IGNORECASE,
    ),
    re.compile(
        r"(?:last\s*date|deadline|register\s*(?:by|before)|apply\s*(?:by|before)|last\s*day)(?:\s+\w+){0,5}?[\s:]+(\d{1,2}\s*(?:st|nd|rd|th)?\s*(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*(?:,?\s*\d{2,4})?)",
        re.IGNORECASE,
    ),
    re.compile(
        r"(?:last\s*date|deadline|register\s*(?:by|before)|apply\s*(?:by|before)|last\s*day)(?:\s+\w+){0,5}?[\s:]+(?:(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*\d{1,2}\s*(?:st|nd|rd|th)?\s*,?\s*\d{2,4})",
        re.IGNORECASE,
    ),
]

_ROLE_KEYWORDS = [
    r"software\s*engineer(?:ing)?(?:\s*intern)?",
    r"sde\s*(?:1|2|i|ii|intern)?",
    r"frontend\s*developer",
    r"backend\s*developer",
    r"full\s*stack\s*developer",
    r"graduate\s*trainee",
    r"management\s*trainee",
    r"product\s*manager(?:\s*intern)?",
    r"data\s*analyst",
    r"qa\s*engineer",
    r"quality\s*assurance",
    r"associate\s*software\s*engineer",
    r"developer",
    r"intern",
]

_ROLE_PATTERN = re.compile(r"\b(" + "|".join(_ROLE_KEYWORDS) + r")\b", re.IGNORECASE)


def _extract_company_from_subject(subject: str) -> Optional[str]:
    """Extract company name from subject using regex heuristics."""
    clean_subj = re.sub(r"^(fwd|fw|re):\s*", "", subject, flags=re.I).strip()

    # Pattern 1: [MEC2K27] Company Name Placement / Internship Drive
    m = re.search(r"\[[A-Za-z0-9]+\]\s*([A-Za-z0-9\s\.\&\-\+\(\)]+?)\s+(?:placement|internship|recruitment|drive|hiring|off-campus|on-campus)", clean_subj, re.I)
    if m:
        name = m.group(1).strip(" -|_")
        if len(name) > 1:
            return name

    # Pattern 2: Placement Drive for <Company>
    m = re.search(r"(?:placement|recruitment|hiring|drive)\s+(?:for|at|by)\s+([A-Za-z0-9\(\)\s\.\&\-]+)", clean_subj, re.I)
    if m:
        name = m.group(1).split("|")[0].split("-")[0].strip()
        if len(name) > 1:
            return name

    # Pattern 3: <Company> Placement / Recruitment / Campus / Hiring / Drive
    m = re.search(r"([A-Za-z0-9\(\)\s\.\&]+?)\s+(?:placement|recruitment|campus|hiring|drive)", clean_subj, re.I)
    if m:
        name = m.group(1).strip(" -|_")
        if len(name) > 1 and name.lower() not in ("campus", "placement", "recruitment", "fwd", "re", "general"):
            return name

    # Pattern 4: Subject start before hyphen/pipe: "People10 - Campus Hiring"
    if "-" in clean_subj or "|" in clean_subj:
        first_part = re.split(r"[-|]", clean_subj)[0].strip()
        if len(first_part) > 2 and not any(kw in first_part.lower() for kw in ["placement", "recruitment", "hiring", "drive", "campus"]):
            return first_part

    return None


def _extract_role(text: str) -> Optional[str]:
    """Extract role title from subject or body."""
    m = _ROLE_PATTERN.search(text)
    if m:
        return m.group(0).title()
    return None


def _extract_role_type(text: str) -> str:
    """Infer role type (internship, full-time, ppo) from text."""
    lower_text = text.lower()
    if "ppo" in lower_text:
        return "ppo"
    if "intern" in lower_text or "stipend" in lower_text:
        return "internship"
    if any(kw in lower_text for kw in ["full time", "full-time", "ctc", "lpa", "permanent"]):
        return "full-time"
    return "unclear"


def regex_extract(body: str, subject: str = "") -> dict:
    """Extract structured fields from email text using regex patterns."""
    combined = f"{subject}\n{body}" if subject else body

    result = {
        "company": _extract_company_from_subject(subject) if subject else None,
        "role": _extract_role(combined),
        "role_type": _extract_role_type(combined),
        "salary_or_stipend": _extract_salary(combined),
        "last_date": _extract_date(combined),
        "register_links": _extract_links(body),
        "bond": None,
    }

    return result


def _extract_salary(text: str) -> Optional[str]:
    """Extract salary or stipend from text."""
    for pattern in _SALARY_PATTERNS:
        match = pattern.search(text)
        if match:
            matched_text = match.group(0).strip()
            return matched_text

    return None


def _extract_date(text: str) -> Optional[str]:
    """Extract registration deadline date from text."""
    for pattern in _DATE_CONTEXT_PATTERNS:
        match = pattern.search(text)
        if match:
            date_str = match.group(1).strip()
            try:
                date_parser.parse(date_str, fuzzy=True, dayfirst=True)
                return date_str
            except (ValueError, OverflowError):
                return date_str

    return None


def _extract_links(text: str) -> list:
    """Extract all registration and application links from text.

    Excludes generic college footers, social media, and unsubscribe links.
    """
    _GENERAL_URL_PATTERN = re.compile(
        r"https?://[^\s<>\"')\]]+",
        re.IGNORECASE,
    )

    all_links = _GENERAL_URL_PATTERN.findall(text)

    _REGISTRATION_INDICATORS = [
        "forms.gle",
        "docs.google.com/forms",
        "forms.google.com",
        "viewform",
        "unstop.com",
        "greenhouse.io",
        "lever.co",
        "workday",
        "naukri",
        "internshala",
        "superset",
        "zoho.com/recruit",
        "careers.",
        "jobs.",
        "apply",
        "register",
        "form",
    ]

    _EXCLUDED_PATTERNS = [
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
        "groups.google.com",
        "mec.ac.in",
        "optout",
    ]

    form_links = []
    seen = set()

    for link in all_links:
        cleaned = link.rstrip(".,;:)")
        lower = cleaned.lower()

        if any(excl in lower for excl in _EXCLUDED_PATTERNS):
            continue

        if any(indicator in lower for indicator in _REGISTRATION_INDICATORS):
            if cleaned not in seen:
                seen.add(cleaned)
                form_links.append(cleaned)

    return form_links


# =============================================================================
# Stage 3: Merge results
# =============================================================================


def merge_results(regex_result: dict, llm_result: dict) -> dict:
    """Merge regex and LLM extraction results."""
    merged = EMPTY_RESULT.copy()

    for field in ["company", "role", "role_type", "bond"]:
        llm_val = llm_result.get(field)
        regex_val = regex_result.get(field)
        merged[field] = llm_val if llm_val is not None else regex_val

    for field in ["salary_or_stipend", "last_date"]:
        regex_val = regex_result.get(field)
        llm_val = llm_result.get(field)
        merged[field] = regex_val if regex_val is not None else llm_val

    regex_links = regex_result.get("register_links", [])
    llm_links = llm_result.get("register_links", [])

    seen = set()
    merged_links = []
    for link in regex_links + llm_links:
        if link not in seen:
            seen.add(link)
            merged_links.append(link)

    merged["register_links"] = merged_links

    regex_contributed = any(
        regex_result.get(f) is not None
        for f in ["salary_or_stipend", "last_date", "register_links", "company", "role"]
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
    """Run the full extraction pipeline on a single email."""
    if not pre_filter(subject, sender, email_body):
        logger.debug(f"Email filtered out: {subject[:50]}")
        return None

    regex_result = regex_extract(email_body, subject)
    llm_result = EMPTY_RESULT.copy()

    if api_key:
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

    merged = merge_results(regex_result, llm_result)

    return merged
