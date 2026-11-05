"""Validates downloaded bytes before any parser touches them."""
from __future__ import annotations

from app.exceptions.extraction_exceptions import DocumentValidationError
from app.utils.checksum import checksum_matches


def validate_downloaded_file(data: bytes, expected_size: int, expected_checksum: str, max_size: int) -> None:
    """Size limit, size match and SHA-256 match against the Document Service metadata."""
    if not data:
        raise DocumentValidationError("Downloaded document is empty")
    if len(data) > max_size:
        raise DocumentValidationError(f"Document exceeds the processing limit of {max_size} bytes")
    if expected_size and len(data) != expected_size:
        raise DocumentValidationError("Downloaded document size does not match the stored metadata")
    if not checksum_matches(data, expected_checksum):
        raise DocumentValidationError("Downloaded document checksum does not match the stored metadata")
