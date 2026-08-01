"""
LLM provider interface and implementations.

Provides a pluggable interface for calling different LLM providers to
extract structured placement data from email bodies. Gemini is the
first supported provider; Groq and OpenRouter can be added by
implementing a simple function with the same signature.

SECURITY: API keys are decrypted in memory only, never logged.
"""

import json
import logging
from typing import Optional
import requests

from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

# The exact JSON schema we ask the LLM to return
EXTRACTION_SCHEMA = {
    "company": "string",
    "role": "string",
    "role_type": "internship | full-time | PPO | unclear",
    "salary_or_stipend": "string or null",
    "bond": "string or null",
    "last_date": "string or null",
    "register_links": ["string"],
}

# System prompt for extraction
EXTRACTION_SYSTEM_PROMPT = """You are an expert email parser for college placement/internship opportunities.

Given an email body, extract the following fields and return ONLY valid JSON — no explanation, no markdown, no extra text.

Fields to extract:
- company: The hiring company name
- role: The job/internship role title
- role_type: One of "internship", "full-time", "PPO", or "unclear"
- salary_or_stipend: The CTC/salary/stipend as stated (e.g. "6 LPA", "₹25,000/month", "unpaid"). Use null if not mentioned.
- bond: Service bond requirement (e.g. "2 years", "none"). Use null if not mentioned.
- last_date: Registration/application deadline date as stated in the email. Use null if not mentioned.
- register_links: Array of ALL registration/application URLs found in the email. Empty array if none found.

Rules:
- Return ONLY the JSON object, nothing else
- Use null for fields you cannot determine from the email
- For register_links, include ALL URLs that look like application/registration links
- For role_type, use "unclear" if you cannot confidently determine the type
- Preserve the original formatting of salary/stipend/date as written in the email"""

# Empty result template
EMPTY_RESULT = {
    "company": None,
    "role": None,
    "role_type": "unclear",
    "salary_or_stipend": None,
    "bond": None,
    "last_date": None,
    "register_links": [],
}


def extract_with_llm(
    email_body: str,
    api_key: str,
    provider: str = "gemini",
    subject: str = "",
    model_id: Optional[str] = None,
) -> dict:
    """Extract structured placement data from an email using an LLM.

    Args:
        email_body: The full email body text.
        api_key: The user's decrypted API key for the provider.
        provider: LLM provider name ('gemini', 'groq', 'openrouter').
        subject: Optional email subject for additional context.
        model_id: Optional specific model ID (primarily for OpenRouter).

    Returns:
        Dict with extracted fields matching EXTRACTION_SCHEMA.
        Returns EMPTY_RESULT on any failure.
    """
    provider_fn = _PROVIDERS.get(provider)

    if not provider_fn:
        logger.error(f"Unsupported LLM provider: {provider}")
        return EMPTY_RESULT.copy()

    try:
        result = provider_fn(email_body, api_key, subject, model_id)
        return _validate_result(result)
    except Exception as e:
        logger.error(f"LLM extraction failed ({provider}): {type(e).__name__}: {e}")
        return EMPTY_RESULT.copy()


def _validate_result(result: dict) -> dict:
    """Validate and normalize an LLM extraction result.

    Ensures all expected keys are present with correct types.
    """
    validated = EMPTY_RESULT.copy()

    if not isinstance(result, dict):
        return validated

    for key in ["company", "role", "salary_or_stipend", "bond", "last_date"]:
        val = result.get(key)
        if val is not None and isinstance(val, str) and val.strip():
            validated[key] = val.strip()

    # Validate role_type
    role_type = result.get("role_type", "unclear")
    if isinstance(role_type, str):
        role_type_lower = role_type.lower().strip()
        valid_types = {"internship", "full-time", "ppo", "unclear"}
        validated["role_type"] = role_type_lower if role_type_lower in valid_types else "unclear"

    # Validate register_links
    links = result.get("register_links", [])
    if isinstance(links, list):
        validated["register_links"] = [
            link.strip() for link in links
            if isinstance(link, str) and link.strip().startswith("http")
        ]

    return validated


# =============================================================================
# Provider implementations
# =============================================================================


def _gemini_extract(email_body: str, api_key: str, subject: str = "", model_id: Optional[str] = None) -> dict:
    """Extract placement data using Google Gemini.

    Uses structured JSON output mode for reliable parsing.
    """
    client = genai.Client(api_key=api_key)

    # Compose the prompt with subject context
    prompt = f"Subject: {subject}\n\nEmail Body:\n{email_body}" if subject else email_body

    # Attempt with retry (1 retry on failure)
    for attempt in range(2):
        try:
            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=EXTRACTION_SYSTEM_PROMPT,
                    response_mime_type="application/json",
                    temperature=0.1,
                ),
            )

            if not response.text:
                logger.warning(f"Gemini returned empty response (attempt {attempt + 1})")
                continue

            return json.loads(response.text)

        except json.JSONDecodeError:
            logger.warning(f"Gemini returned invalid JSON (attempt {attempt + 1})")
            continue
        except Exception as e:
            logger.error(f"Gemini API call failed (attempt {attempt + 1}): {e}")
            if attempt == 0:
                continue
            raise

    return EMPTY_RESULT.copy()


def _groq_extract(email_body: str, api_key: str, subject: str = "", model_id: Optional[str] = None) -> dict:
    """Placeholder for Groq provider — to be implemented.

    Will use the Groq API with JSON mode when added.
    """
    raise NotImplementedError("Groq provider not yet implemented. Use 'gemini' for now.")


def _openrouter_extract(email_body: str, api_key: str, subject: str = "", model_id: Optional[str] = None) -> dict:
    """Extract placement data using OpenRouter."""
    if not model_id:
        model_id = "google/gemini-2.5-flash"

    prompt = f"Subject: {subject}\n\nEmail Body:\n{email_body}" if subject else email_body

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:5000",
        "X-Title": "Placement Mail Tracker"
    }

    payload = {
        "model": model_id,
        "messages": [
            {
                "role": "system",
                "content": EXTRACTION_SYSTEM_PROMPT
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        "response_format": {
            "type": "json_object"
        },
        "temperature": 0.1
    }

    for attempt in range(2):
        try:
            response = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=30
            )
            response.raise_for_status()
            data = response.json()
            choices = data.get("choices", [])
            if not choices:
                logger.warning(f"OpenRouter returned no choices (attempt {attempt + 1})")
                continue
            content = choices[0].get("message", {}).get("content", "")
            if not content:
                logger.warning(f"OpenRouter returned empty content (attempt {attempt + 1})")
                continue
            return json.loads(content)
        except json.JSONDecodeError:
            logger.warning(f"OpenRouter returned invalid JSON (attempt {attempt + 1})")
            continue
        except Exception as e:
            logger.error(f"OpenRouter API call failed (attempt {attempt + 1}): {e}")
            if attempt == 0:
                continue
            raise

    return EMPTY_RESULT.copy()


# Provider dispatch map — add new providers here
_PROVIDERS = {
    "gemini": _gemini_extract,
    "groq": _groq_extract,
    "openrouter": _openrouter_extract,
}


def get_supported_providers() -> list:
    """Return list of currently supported (implemented) provider names."""
    return ["gemini", "openrouter"]  # Update as providers are implemented
