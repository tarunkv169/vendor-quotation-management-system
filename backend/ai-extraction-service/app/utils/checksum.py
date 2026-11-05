"""SHA-256 helpers (hex encoding, same as the Document Service checksum column)."""
from __future__ import annotations

import hashlib
import hmac


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def checksum_matches(data: bytes, expected_hex: str) -> bool:
    """Constant-time comparison of the computed and the expected checksum."""
    return hmac.compare_digest(sha256_hex(data), expected_hex.lower())
