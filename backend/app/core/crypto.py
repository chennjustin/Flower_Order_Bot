"""Symmetric encryption for secrets at rest (Google refresh tokens).

Uses Fernet (AES-128-CBC + HMAC) keyed by GOOGLE_TOKEN_ENCRYPTION_KEY so refresh
tokens are never stored in plaintext. Generate a key once with:

    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
"""

from __future__ import annotations

from functools import lru_cache

from cryptography.fernet import Fernet

from app.core.settings import load_settings


@lru_cache(maxsize=1)
def _fernet() -> Fernet:
    settings = load_settings()
    key = settings.google_token_encryption_key
    if not key:
        raise RuntimeError(
            "GOOGLE_TOKEN_ENCRYPTION_KEY is not set; cannot encrypt/decrypt Google tokens."
        )
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_token(plaintext: str) -> str:
    """Encrypt a secret string for storage. Returns a URL-safe base64 token."""
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt_token(ciphertext: str) -> str:
    """Decrypt a value produced by :func:`encrypt_token`."""
    return _fernet().decrypt(ciphertext.encode()).decode()
