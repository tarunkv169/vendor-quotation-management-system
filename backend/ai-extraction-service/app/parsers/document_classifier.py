"""Identifies the real document format from magic bytes (never from the file name)."""
from __future__ import annotations

import io
import zipfile

from app.exceptions.extraction_exceptions import DocumentValidationError, UnsupportedDocumentError
from app.schemas.quotation_schema import DocumentFormat

_MAX_ZIP_ENTRIES = 10_000


def classify(data: bytes, declared_content_type: str | None) -> DocumentFormat:
    """Returns PDF, XLSX or IMAGE. SCANNED_PDF is decided later, after text extraction."""
    if data.startswith(b"%PDF-"):
        detected = DocumentFormat.PDF
    elif data.startswith(b"\x89PNG\r\n\x1a\n") or data.startswith(b"\xff\xd8\xff"):
        detected = DocumentFormat.IMAGE
    elif data.startswith(b"PK\x03\x04"):
        _assert_safe_workbook(data)
        detected = DocumentFormat.XLSX
    else:
        raise UnsupportedDocumentError("Unsupported or unrecognised document format")

    if declared_content_type and not _declared_matches(detected, declared_content_type):
        raise DocumentValidationError(
            f"Document content ({detected.value}) does not match declared type {declared_content_type}")
    return detected


def _declared_matches(detected: DocumentFormat, declared: str) -> bool:
    declared = declared.lower()
    return {
        DocumentFormat.PDF: declared == "application/pdf",
        DocumentFormat.IMAGE: declared in ("image/png", "image/jpeg"),
        DocumentFormat.XLSX: declared == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }[detected]


def _assert_safe_workbook(data: bytes) -> None:
    """Defence in depth (Document Service checks this too): real workbook, no VBA macros."""
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            names = archive.namelist()
    except zipfile.BadZipFile as exc:
        raise DocumentValidationError("Corrupted spreadsheet archive") from exc
    if len(names) > _MAX_ZIP_ENTRIES:
        raise DocumentValidationError("Spreadsheet archive contains too many entries")
    lowered = [n.lower() for n in names]
    if any(n.endswith("vbaproject.bin") for n in lowered):
        raise DocumentValidationError("Macro-enabled workbooks are not processed")
    if "xl/workbook.xml" not in lowered:
        raise UnsupportedDocumentError("Archive is not an Excel workbook")
