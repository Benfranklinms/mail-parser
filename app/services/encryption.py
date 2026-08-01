"""
Encryption utility using Fernet symmetric encryption.

Encrypts/decrypts Gmail refresh tokens and LLM API keys before they
touch the database. The Fernet key is read from the FERNET_KEY
environment variable — never hardcoded or committed.

SECURITY: Never log inputs or outputs of these functions.
"""

import os
import logging

from cryptography.fernet import Fernet, InvalidToken

logger = logging.getLogger(__name__)

# Load the Fernet key from environment at module init
_fernet_key = os.environ.get("FERNET_KEY")
_fernet = None

if _fernet_key:
    try:
        _fernet = Fernet(_fernet_key.encode() if isinstance(_fernet_key, str) else _fernet_key)
    except Exception:
        logger.error("Invalid FERNET_KEY — encryption will not work.")


def _get_fernet() -> Fernet:
    """Get the Fernet instance, raising if not configured."""
    if _fernet is None:
        raise RuntimeError(
            "Encryption not configured. Set the FERNET_KEY environment variable. "
            "Generate one with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
        )
    return _fernet


def encrypt(plaintext: str) -> str:
    """Encrypt a plaintext string, returning a base64-encoded ciphertext string.

    Args:
        plaintext: The sensitive value to encrypt (e.g., API key, refresh token).

    Returns:
        Base64-encoded ciphertext suitable for database storage.
    """
    f = _get_fernet()
    ciphertext_bytes = f.encrypt(plaintext.encode("utf-8"))
    return ciphertext_bytes.decode("utf-8")


def decrypt(ciphertext: str) -> str:
    """Decrypt a base64-encoded ciphertext string back to plaintext.

    Args:
        ciphertext: The encrypted value from the database.

    Returns:
        The original plaintext string.

    Raises:
        InvalidToken: If the ciphertext is invalid or was encrypted with a different key.
    """
    f = _get_fernet()
    try:
        plaintext_bytes = f.decrypt(ciphertext.encode("utf-8"))
        return plaintext_bytes.decode("utf-8")
    except InvalidToken:
        logger.error("Failed to decrypt value — token is invalid or key has changed.")
        raise


def mask_key(api_key: str) -> str:
    """Return a masked version of an API key showing only the last 4 characters.

    Args:
        api_key: The full API key.

    Returns:
        Masked string like '****abcd'.
    """
    if len(api_key) <= 4:
        return "****"
    return "****" + api_key[-4:]


def get_last_four(api_key: str) -> str:
    """Extract the last 4 characters of an API key for storage as identifier.

    Args:
        api_key: The full API key.

    Returns:
        Last 4 characters, or the full key if shorter than 4 chars.
    """
    return api_key[-4:] if len(api_key) >= 4 else api_key
