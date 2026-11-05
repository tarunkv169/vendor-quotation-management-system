"""Deterministic parsing of document text into Decimal, int and date.

Rules:
- Never use float. All numbers go through `Decimal(str)`.
- Return (value, ambiguous). `ambiguous=True` means a human should confirm the value.
- Unparseable text returns (None, False) and the field is reported as unverified/missing.
"""
from __future__ import annotations

import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

_CURRENCY_NOISE = re.compile(r"(?i)\b(inr|rs|usd|eur|gbp|aed|sgd)\b\.?|[₹$€£¥]|/-")
_NUMBER_CHARS = re.compile(r"[^0-9,.\-()]")
_GROUPED_THOUSANDS = re.compile(r"^\d{1,3}(,\d{2,3})+$")

_MONTHS = {m: i for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], start=1)}


def parse_decimal(text: str | None) -> tuple[Decimal | None, bool]:
    """Parses amounts such as '₹1,23,456.50', '1.234,56', '(150.00)', '12 %'."""
    if text is None:
        return None, False
    cleaned = _CURRENCY_NOISE.sub("", text).replace("%", "").strip()
    negative = cleaned.startswith("(") and cleaned.endswith(")")
    cleaned = _NUMBER_CHARS.sub("", cleaned).strip("()")
    if cleaned.startswith("-"):
        negative, cleaned = True, cleaned[1:]
    if not cleaned or not any(ch.isdigit() for ch in cleaned):
        return None, False

    ambiguous = False
    has_comma, has_dot = "," in cleaned, "." in cleaned
    if has_comma and has_dot:
        # The right-most separator is the decimal separator.
        if cleaned.rfind(",") > cleaned.rfind("."):
            cleaned = cleaned.replace(".", "").replace(",", ".")
        else:
            cleaned = cleaned.replace(",", "")
    elif has_comma:
        if _GROUPED_THOUSANDS.match(cleaned):
            cleaned = cleaned.replace(",", "")
        elif cleaned.count(",") == 1 and len(cleaned.split(",")[1]) in (1, 2):
            cleaned = cleaned.replace(",", ".")  # decimal comma, e.g. "12,5"
            ambiguous = True
        else:
            return None, False
    elif cleaned.count(".") > 1:
        cleaned = cleaned.replace(".", "")  # "1.234.567" European grouping
        ambiguous = True

    try:
        value = Decimal(cleaned)
    except InvalidOperation:
        return None, False
    return (-value if negative else value), ambiguous


def parse_int(text: str | None) -> tuple[int | None, bool]:
    """Extracts the first whole number, e.g. '30 days' -> 30. Ranges like '2-3 weeks' are ambiguous."""
    if text is None:
        return None, False
    numbers = re.findall(r"\d+", text)
    if not numbers:
        return None, False
    ambiguous = len(numbers) > 1
    return int(numbers[0]), ambiguous


def parse_date(text: str | None, day_first: bool = True) -> tuple[date | None, bool]:
    """Parses ISO, numeric (dd/mm/yyyy or mm/dd/yyyy) and textual dates ('5 Jan 2025', 'Jan 5, 2025')."""
    if text is None:
        return None, False
    raw = text.strip()

    try:
        return datetime.strptime(raw[:10], "%Y-%m-%d").date(), False
    except ValueError:
        pass

    numeric = re.match(r"^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$", raw)
    if numeric:
        a, b, year = int(numeric.group(1)), int(numeric.group(2)), int(numeric.group(3))
        year = year + 2000 if year < 100 else year
        if a > 12 >= b:  # only interpretation: a is the day
            day, month, ambiguous = a, b, False
        elif b > 12 >= a:  # only interpretation: b is the day
            day, month, ambiguous = b, a, False
        else:  # both <= 12: follow the configured convention, flag if it matters
            day, month = (a, b) if day_first else (b, a)
            ambiguous = a != b
        try:
            return date(year, month, day), ambiguous
        except ValueError:
            return None, False

    textual = re.match(r"^(\d{1,2})(?:st|nd|rd|th)?[\s\-]+([A-Za-z]{3,})[\s\-,]+(\d{4})$", raw)
    if textual:
        month = _MONTHS.get(textual.group(2)[:3].lower())
        if month:
            try:
                return date(int(textual.group(3)), month, int(textual.group(1))), False
            except ValueError:
                return None, False

    textual_us = re.match(r"^([A-Za-z]{3,})\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$", raw)
    if textual_us:
        month = _MONTHS.get(textual_us.group(1)[:3].lower())
        if month:
            try:
                return date(int(textual_us.group(3)), month, int(textual_us.group(2))), False
            except ValueError:
                return None, False
    return None, False


_CURRENCY_SYMBOLS = {"₹": "INR", "rs": "INR", "rs.": "INR", "$": "USD", "€": "EUR", "£": "GBP", "¥": "JPY"}


def normalize_currency(text: str | None) -> tuple[str | None, bool]:
    """Maps symbols/words to ISO-4217 codes. '$' is ambiguous (USD/SGD/AUD...)."""
    if text is None:
        return None, False
    raw = text.strip()
    code = re.search(r"\b([A-Z]{3})\b", raw.upper())
    if code:
        return code.group(1), False
    key = raw.lower()
    if key in _CURRENCY_SYMBOLS:
        return _CURRENCY_SYMBOLS[key], key == "$"
    for symbol, iso in _CURRENCY_SYMBOLS.items():
        if symbol in raw:
            return iso, symbol == "$"
    return None, False
