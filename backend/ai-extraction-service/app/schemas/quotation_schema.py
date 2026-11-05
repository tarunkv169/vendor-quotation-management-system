"""Validated, application-level quotation extraction schemas.

Financial values are `Decimal` (never float). Every field keeps:
- `value`      the parsed value (or None when missing/unparseable)
- `raw_text`   the exact text as written in the document
- `evidence`   where it was found (verbatim snippet + page + method)
- `confidence` evidence-based confidence (set by the confidence service, not by the LLM)

Amounts named `*_stated` are copied from the document only. They are NOT calculated here;
the Java Quotation Service remains the source of truth for all calculations.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal
from enum import Enum
from typing import Generic, Literal, TypeVar

from pydantic import ConfigDict, Field

from app.schemas.base import ApiModel

T = TypeVar("T")


class ExtractionStatus(str, Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    FAILED = "FAILED"


class DocumentFormat(str, Enum):
    PDF = "PDF"
    SCANNED_PDF = "SCANNED_PDF"
    XLSX = "XLSX"
    IMAGE = "IMAGE"


class ConfidenceLevel(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


ExtractionMethod = Literal["NATIVE_TEXT", "OCR", "SPREADSHEET"]


class ExtractedFieldEvidence(ApiModel):
    """Where a value came from in the source document."""

    model_config = ConfigDict(**ApiModel.model_config, frozen=True)

    source_text: str | None = Field(default=None, max_length=500)
    page: int | None = Field(default=None, ge=1)
    extraction_method: ExtractionMethod
    found_in_source: bool = Field(description="True when source_text was located verbatim in the document text")


class ConfidenceResult(ApiModel):
    score: Decimal = Field(ge=Decimal("0"), le=Decimal("1"), decimal_places=3)
    level: ConfidenceLevel
    reasons: list[str] = Field(default_factory=list)


class ExtractedField(ApiModel, Generic[T]):
    value: T | None = None
    raw_text: str | None = Field(default=None, max_length=500)
    evidence: ExtractedFieldEvidence | None = None
    confidence: ConfidenceResult | None = None
    ambiguous: bool = False


class ExtractedVendorInformation(ApiModel):
    name: ExtractedField[str] = Field(default_factory=ExtractedField[str])
    tax_id: ExtractedField[str] = Field(default_factory=ExtractedField[str])
    email: ExtractedField[str] = Field(default_factory=ExtractedField[str])
    phone: ExtractedField[str] = Field(default_factory=ExtractedField[str])
    address: ExtractedField[str] = Field(default_factory=ExtractedField[str])


class ExtractedQuotationItem(ApiModel):
    line_number: int = Field(ge=1)
    product_name: ExtractedField[str] = Field(default_factory=ExtractedField[str])
    description: ExtractedField[str] = Field(default_factory=ExtractedField[str])
    quantity: ExtractedField[Decimal] = Field(default_factory=ExtractedField[Decimal])
    unit: ExtractedField[str] = Field(default_factory=ExtractedField[str])
    unit_price: ExtractedField[Decimal] = Field(default_factory=ExtractedField[Decimal])
    tax_rate_percent: ExtractedField[Decimal] = Field(default_factory=ExtractedField[Decimal])
    discount_rate_percent: ExtractedField[Decimal] = Field(default_factory=ExtractedField[Decimal])
    line_amount_stated: ExtractedField[Decimal] = Field(default_factory=ExtractedField[Decimal])


class ExtractedFinancialInformation(ApiModel):
    currency_code: ExtractedField[str] = Field(default_factory=ExtractedField[str])
    subtotal_stated: ExtractedField[Decimal] = Field(default_factory=ExtractedField[Decimal])
    discount_amount_stated: ExtractedField[Decimal] = Field(default_factory=ExtractedField[Decimal])
    tax_amount_stated: ExtractedField[Decimal] = Field(default_factory=ExtractedField[Decimal])
    total_amount_stated: ExtractedField[Decimal] = Field(default_factory=ExtractedField[Decimal])


class QuotationExtraction(ApiModel):
    quotation_number: ExtractedField[str] = Field(default_factory=ExtractedField[str])
    quotation_date: ExtractedField[date] = Field(default_factory=ExtractedField[date])
    valid_until: ExtractedField[date] = Field(default_factory=ExtractedField[date])
    vendor: ExtractedVendorInformation = Field(default_factory=ExtractedVendorInformation)
    items: list[ExtractedQuotationItem] = Field(default_factory=list, max_length=1000)
    financials: ExtractedFinancialInformation = Field(default_factory=ExtractedFinancialInformation)
    delivery_terms: ExtractedField[str] = Field(default_factory=ExtractedField[str])
    delivery_days: ExtractedField[int] = Field(default_factory=ExtractedField[int])
    warranty_terms: ExtractedField[str] = Field(default_factory=ExtractedField[str])
    warranty_months: ExtractedField[int] = Field(default_factory=ExtractedField[int])
    payment_terms: ExtractedField[str] = Field(default_factory=ExtractedField[str])


IssueType = Literal["MISSING", "AMBIGUOUS", "INCONSISTENT", "LOW_CONFIDENCE", "UNVERIFIED", "TRUNCATED"]
IssueSeverity = Literal["ERROR", "WARNING", "INFO"]


class MissingField(ApiModel):
    """A missing, ambiguous, inconsistent or unverified field that may need human review."""

    field_path: str = Field(description="e.g. 'items[2].unit_price'")
    issue_type: IssueType
    severity: IssueSeverity
    message: str
