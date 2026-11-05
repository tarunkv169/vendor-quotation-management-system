"""Excel (xlsx) extraction with openpyxl.

- `read_only=True` streams rows with low memory.
- `data_only=True` returns the cached cell values; formulas are never evaluated and
  macros cannot run (xlsx cannot contain VBA, and .xlsm is rejected upstream).
- Row/column limits protect against huge sheets.
"""
from __future__ import annotations

import io
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal

from openpyxl import load_workbook

from app.exceptions.extraction_exceptions import DocumentValidationError


@dataclass
class SheetContent:
    sheet_number: int
    name: str
    rows: list[list[str]]
    truncated: bool


def extract_workbook(data: bytes, max_rows: int, max_columns: int) -> list[SheetContent]:
    try:
        workbook = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
    except Exception as exc:
        raise DocumentValidationError("Excel workbook is corrupted or cannot be opened") from exc

    sheets: list[SheetContent] = []
    try:
        for number, sheet in enumerate(workbook.worksheets, start=1):
            rows: list[list[str]] = []
            truncated = False
            for row_index, row in enumerate(sheet.iter_rows(values_only=True)):
                if row_index >= max_rows:
                    truncated = True
                    break
                cells = [_cell_to_text(value) for value in row[:max_columns]]
                if any(cells):
                    rows.append(_trim_trailing_empty(cells))
            sheets.append(SheetContent(sheet_number=number, name=str(sheet.title), rows=rows, truncated=truncated))
    finally:
        workbook.close()
    return sheets


def _cell_to_text(value: object) -> str:
    """Converts cell values to text without float artefacts (e.g. 0.1 + 0.2)."""
    if value is None:
        return ""
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, float):
        # repr() gives the shortest round-trip representation; Decimal keeps it exact from here on.
        return format(Decimal(repr(value)).normalize(), "f")
    if isinstance(value, (datetime, date)):
        return value.date().isoformat() if isinstance(value, datetime) else value.isoformat()
    return str(value).strip()


def _trim_trailing_empty(cells: list[str]) -> list[str]:
    while cells and not cells[-1]:
        cells.pop()
    return cells
