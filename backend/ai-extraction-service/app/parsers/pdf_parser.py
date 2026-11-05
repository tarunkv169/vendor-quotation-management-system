"""Native PDF text and table extraction with PyMuPDF.

PyMuPDF never executes embedded JavaScript, launches actions or opens embedded files,
so parsing is safe for untrusted PDFs. Encrypted PDFs are rejected.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field

import pymupdf

from app.exceptions.extraction_exceptions import DocumentValidationError

log = logging.getLogger(__name__)


@dataclass
class PageContent:
    page_number: int
    text: str
    tables: list[list[list[str]]] = field(default_factory=list)

    @property
    def char_count(self) -> int:
        return len(self.text.strip())


@dataclass
class PdfContent:
    pages: list[PageContent]
    page_count: int


def extract_pdf(data: bytes, max_pages: int) -> PdfContent:
    try:
        document = pymupdf.open(stream=data, filetype="pdf")
    except Exception as exc:  # PyMuPDF raises several internal types
        raise DocumentValidationError("PDF is corrupted or cannot be opened") from exc

    with document:
        if document.needs_pass or document.is_encrypted:
            raise DocumentValidationError("Password-protected PDFs are not supported")
        if document.page_count > max_pages:
            raise DocumentValidationError(f"PDF has {document.page_count} pages; the limit is {max_pages}")

        pages: list[PageContent] = []
        for index, page in enumerate(document, start=1):
            text = page.get_text("text") or ""
            pages.append(PageContent(page_number=index, text=text, tables=_extract_tables(page, index)))
        return PdfContent(pages=pages, page_count=document.page_count)


def _extract_tables(page: pymupdf.Page, page_number: int) -> list[list[list[str]]]:
    try:
        finder = page.find_tables()
    except Exception:  # table detection is best effort
        log.debug("Table detection failed on page %s", page_number)
        return []
    tables: list[list[list[str]]] = []
    for table in finder.tables:
        rows = [[(cell or "").strip() for cell in row] for row in table.extract()]
        if rows:
            tables.append(rows)
    return tables


def render_pages_for_ocr(data: bytes, page_numbers: list[int], dpi: int) -> dict[int, bytes]:
    """Renders the given 1-based pages to PNG bytes for OCR."""
    rendered: dict[int, bytes] = {}
    with pymupdf.open(stream=data, filetype="pdf") as document:
        for number in page_numbers:
            pixmap = document[number - 1].get_pixmap(dpi=dpi)
            rendered[number] = pixmap.tobytes("png")
    return rendered
