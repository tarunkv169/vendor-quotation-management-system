"""Evidence-based confidence scoring and completeness checks.

The LLM's own opinion of its certainty is NOT used as a score. A field is trusted when
we can verify it against the document text:

    +0.45  the evidence snippet is found verbatim (whitespace/case-insensitive) in the document
    +0.30  the raw value text is found in the document
    +0.25  the raw value parsed cleanly into the target type
    cap 0.50 when the value is ambiguous (e.g. 05/06/2025, decimal comma, '$')
    x0.90 when the text came from OCR, x0.75 more when OCR word confidence < 70 %

Arithmetic in `check_item_consistency` is only a cross-check to flag inconsistencies.
It never produces values that are returned as quotation amounts.
"""
from __future__ import annotations

import re
import unicodedata
from decimal import ROUND_HALF_UP, Decimal

from app.schemas.quotation_schema import (
    ConfidenceLevel,
    ConfidenceResult,
    ExtractedField,
    ExtractedQuotationItem,
    MissingField,
    QuotationExtraction,
)

_WS = re.compile(r"\s+")
_THREE_PLACES = Decimal("0.001")


def normalize_for_match(text: str) -> str:
    text = unicodedata.normalize("NFKC", text).lower()
    return _WS.sub(" ", text).strip()


class SourceIndex:
    """Normalized document text used to verify evidence."""

    def __init__(self, source_text: str) -> None:
        self._normalized = normalize_for_match(source_text)
        self._compact = self._normalized.replace(" ", "")

    def contains(self, snippet: str | None) -> bool:
        if not snippet or not snippet.strip():
            return False
        normalized = normalize_for_match(snippet)
        if normalized in self._normalized:
            return True
        # Table/OCR text often loses spaces: compare without whitespace as a fallback.
        compact = normalized.replace(" ", "")
        return len(compact) >= 3 and compact in self._compact


class ConfidenceService:
    def __init__(self, high_threshold: Decimal, review_threshold: Decimal) -> None:
        self._high = high_threshold
        self._review = review_threshold

    # ------------------------------------------------------------------ scoring

    def score_field(self, field: ExtractedField, source: SourceIndex,
                    from_ocr: bool, ocr_confidence: Decimal | None) -> None:
        """Sets `field.confidence` in place."""
        if field.value is None and field.raw_text is None:
            field.confidence = ConfidenceResult(score=Decimal("0.000"), level=ConfidenceLevel.LOW,
                                                reasons=["Value not found in document"])
            return

        score = Decimal(0)
        reasons: list[str] = []
        if field.evidence is not None and field.evidence.found_in_source:
            score += Decimal("0.45")
        else:
            reasons.append("Evidence could not be located in the document text")
        if source.contains(field.raw_text):
            score += Decimal("0.30")
        else:
            reasons.append("Raw value not found verbatim in the document")
        if field.value is not None:
            score += Decimal("0.25")
        else:
            reasons.append("Value could not be parsed")
        if field.ambiguous:
            score = min(score, Decimal("0.50"))
            reasons.append("Value is ambiguous")
        if from_ocr:
            score *= Decimal("0.90")
            reasons.append("Read with OCR")
            if ocr_confidence is not None and ocr_confidence < Decimal("0.70"):
                score *= Decimal("0.75")
                reasons.append("Low OCR quality")

        score = score.quantize(_THREE_PLACES, rounding=ROUND_HALF_UP)
        field.confidence = ConfidenceResult(score=score, level=self._level(score), reasons=reasons)

    def _level(self, score: Decimal) -> ConfidenceLevel:
        if score >= self._high:
            return ConfidenceLevel.HIGH
        if score >= self._review:
            return ConfidenceLevel.MEDIUM
        return ConfidenceLevel.LOW

    def is_low(self, field: ExtractedField) -> bool:
        return field.confidence is not None and field.confidence.score < self._review

    # ------------------------------------------------------------------ cross-checks

    @staticmethod
    def check_item_consistency(item: ExtractedQuotationItem, index: int) -> MissingField | None:
        """Flags a printed line amount that matches none of the plausible readings.

        Accepted readings: qty x price, minus the discount rate, plus the tax rate.
        Tolerance: 1 % of the printed amount or 1 currency unit, whichever is larger.
        """
        qty, price, stated = item.quantity.value, item.unit_price.value, item.line_amount_stated.value
        if qty is None or price is None or stated is None:
            return None
        gross = qty * price
        discount = item.discount_rate_percent.value or Decimal(0)
        tax = item.tax_rate_percent.value or Decimal(0)
        net = gross * (Decimal(100) - discount) / Decimal(100)
        with_tax = net * (Decimal(100) + tax) / Decimal(100)
        tolerance = max(abs(stated) * Decimal("0.01"), Decimal(1))
        if any(abs(candidate - stated) <= tolerance for candidate in (gross, net, with_tax)):
            return None
        return MissingField(
            field_path=f"items[{index}].lineAmountStated",
            issue_type="INCONSISTENT",
            severity="WARNING",
            message="Printed line amount does not match quantity x unit price (with stated discount/tax)",
        )

    # ------------------------------------------------------------------ completeness

    def find_issues(self, quotation: QuotationExtraction) -> list[MissingField]:
        issues: list[MissingField] = []

        def check(path: str, field: ExtractedField, severity: str, critical_financial: bool = False,
                  present_only: bool = False) -> None:
            if present_only and field.raw_text is None:
                return  # optional field: absence is fine, but a present value must be trustworthy
            if field.value is None:
                issue_type = "UNVERIFIED" if field.raw_text else "MISSING"
                issues.append(MissingField(field_path=path, issue_type=issue_type, severity=severity,
                                           message=f"{path} is {'unparseable' if field.raw_text else 'missing'}"))
                return
            if field.ambiguous:
                issues.append(MissingField(field_path=path, issue_type="AMBIGUOUS",
                                           severity="ERROR" if critical_financial else "WARNING",
                                           message=f"{path} is ambiguous; please confirm"))
            if field.evidence is not None and not field.evidence.found_in_source:
                issues.append(MissingField(field_path=path, issue_type="UNVERIFIED",
                                           severity="ERROR" if critical_financial else "WARNING",
                                           message=f"{path} could not be verified against the document"))
            elif self.is_low(field):
                issues.append(MissingField(field_path=path, issue_type="LOW_CONFIDENCE",
                                           severity="ERROR" if critical_financial else "WARNING",
                                           message=f"{path} has low confidence"))

        check("quotationNumber", quotation.quotation_number, "WARNING")
        check("vendor.name", quotation.vendor.name, "ERROR")
        check("financials.currencyCode", quotation.financials.currency_code, "WARNING", critical_financial=True)
        check("financials.totalAmountStated", quotation.financials.total_amount_stated, "WARNING",
              critical_financial=True)
        for path, field in (
            ("financials.subtotalStated", quotation.financials.subtotal_stated),
            ("financials.taxAmountStated", quotation.financials.tax_amount_stated),
            ("financials.discountAmountStated", quotation.financials.discount_amount_stated),
        ):
            check(path, field, "WARNING", critical_financial=True, present_only=True)
        for path, field in (
            ("quotationDate", quotation.quotation_date),
            ("validUntil", quotation.valid_until),
            ("deliveryDays", quotation.delivery_days),
            ("warrantyMonths", quotation.warranty_months),
            ("deliveryTerms", quotation.delivery_terms),
            ("warrantyTerms", quotation.warranty_terms),
            ("paymentTerms", quotation.payment_terms),
        ):
            check(path, field, "WARNING", present_only=True)

        if not quotation.items:
            issues.append(MissingField(field_path="items", issue_type="MISSING", severity="ERROR",
                                       message="No quotation line items were found"))
        for i, item in enumerate(quotation.items):
            if item.product_name.value is None and item.description.value is None:
                issues.append(MissingField(field_path=f"items[{i}].productName", issue_type="MISSING",
                                           severity="ERROR", message="Item has no product name or description"))
            check(f"items[{i}].quantity", item.quantity, "ERROR", critical_financial=True)
            check(f"items[{i}].unitPrice", item.unit_price, "ERROR", critical_financial=True)
            check(f"items[{i}].unit", item.unit, "WARNING")
            consistency = self.check_item_consistency(item, i)
            if consistency is not None:
                issues.append(consistency)
        return issues

    @staticmethod
    def overall_confidence(quotation: QuotationExtraction) -> Decimal:
        """Mean confidence of the fields that matter most; missing ones count as 0."""
        fields: list[ExtractedField] = [
            quotation.quotation_number, quotation.vendor.name,
            quotation.financials.currency_code, quotation.financials.total_amount_stated,
        ]
        for item in quotation.items:
            fields.extend([item.quantity, item.unit_price])
        scores = [f.confidence.score if f.confidence else Decimal(0) for f in fields]
        if not scores:
            return Decimal("0.000")
        return (sum(scores) / Decimal(len(scores))).quantize(_THREE_PLACES, rounding=ROUND_HALF_UP)
