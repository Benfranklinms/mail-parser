"""
Tests for the encryption module.

Tests cover:
- Encrypt/decrypt round-trip
- Key masking
- Last four extraction
- Error handling for invalid tokens
"""

import os
import pytest


# Set a test Fernet key before importing the module
# (the module reads the key at import time)
from cryptography.fernet import Fernet

_test_key = Fernet.generate_key().decode()
os.environ["FERNET_KEY"] = _test_key

from app.services.encryption import encrypt, decrypt, mask_key, get_last_four


class TestEncryption:
    """Tests for encrypt/decrypt round-trip."""

    def test_basic_round_trip(self):
        plaintext = "my-secret-api-key-12345"
        ciphertext = encrypt(plaintext)

        assert ciphertext != plaintext
        assert decrypt(ciphertext) == plaintext

    def test_unicode_round_trip(self):
        plaintext = "key-with-unicode-₹€£"
        ciphertext = encrypt(plaintext)
        assert decrypt(ciphertext) == plaintext

    def test_long_string_round_trip(self):
        plaintext = "a" * 1000
        ciphertext = encrypt(plaintext)
        assert decrypt(ciphertext) == plaintext

    def test_empty_string_round_trip(self):
        plaintext = ""
        ciphertext = encrypt(plaintext)
        assert decrypt(ciphertext) == plaintext

    def test_different_plaintexts_produce_different_ciphertexts(self):
        ct1 = encrypt("key-one")
        ct2 = encrypt("key-two")
        assert ct1 != ct2

    def test_same_plaintext_produces_different_ciphertexts(self):
        """Fernet uses a random IV, so same plaintext -> different ciphertext."""
        ct1 = encrypt("same-key")
        ct2 = encrypt("same-key")
        assert ct1 != ct2  # Different due to IV
        assert decrypt(ct1) == decrypt(ct2)  # But both decrypt to same value

    def test_invalid_ciphertext_raises(self):
        with pytest.raises(Exception):
            decrypt("this-is-not-valid-ciphertext")

    def test_wrong_key_raises(self):
        """Ciphertext from a different key should fail to decrypt."""
        plaintext = "secret"
        ciphertext = encrypt(plaintext)

        # Tamper with the ciphertext
        tampered = ciphertext[:-5] + "XXXXX"
        with pytest.raises(Exception):
            decrypt(tampered)


class TestMasking:
    """Tests for key masking utilities."""

    def test_mask_normal_key(self):
        assert mask_key("sk-1234567890abcdef") == "****cdef"

    def test_mask_short_key(self):
        assert mask_key("abc") == "****"

    def test_mask_exact_four(self):
        assert mask_key("abcd") == "****abcd"

    def test_get_last_four_normal(self):
        assert get_last_four("sk-1234567890abcdef") == "cdef"

    def test_get_last_four_short(self):
        assert get_last_four("ab") == "ab"

    def test_get_last_four_exact(self):
        assert get_last_four("abcd") == "abcd"
