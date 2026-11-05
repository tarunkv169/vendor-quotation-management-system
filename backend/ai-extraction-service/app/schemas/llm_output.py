"""Raw structured-output contract for the LLM.

The LLM returns every value as the literal text found in the document (strings only).
Parsing into Decimal/date happens in our code, so the model never performs numeric
conversion or arithmetic and binary floats never enter the pipeline.
"""
from __future__ import annotations

from pydantic import BaseModel, Field


class LlmField(BaseModel):
    value: str | None = Field(default=None, description="Value exactly as written in the document, or null if absent")
    evidence: str | None = Field(
        default=None, description="Short verbatim snippet (max ~200 chars) from the document containing the value"
    )
    page: int | None = Field(default=None, description="1-based page/sheet number where the evidence appears")
    ambiguous: bool = Field(default=False, description="True if the document is unclear or has conflicting values")


class LlmItem(BaseModel):
    product_name: LlmField = Field(default_factory=LlmField)
    description: LlmField = Field(default_factory=LlmField)
    quantity: LlmField = Field(default_factory=LlmField)
    unit: LlmField = Field(default_factory=LlmField)
    unit_price: LlmField = Field(default_factory=LlmField)
    tax_rate_percent: LlmField = Field(default_factory=LlmField)
    discount_rate_percent: LlmField = Field(default_factory=LlmField)
    line_amount: LlmField = Field(default_factory=LlmField, description="Line total exactly as printed; never computed")


class LlmQuotation(BaseModel):
    """Quotation fields as literally found in the document."""

    quotation_number: LlmField = Field(default_factory=LlmField)
    quotation_date: LlmField = Field(default_factory=LlmField)
    valid_until: LlmField = Field(default_factory=LlmField)
    vendor_name: LlmField = Field(default_factory=LlmField)
    vendor_tax_id: LlmField = Field(default_factory=LlmField, description="GSTIN / VAT / tax registration number")
    vendor_email: LlmField = Field(default_factory=LlmField)
    vendor_phone: LlmField = Field(default_factory=LlmField)
    vendor_address: LlmField = Field(default_factory=LlmField)
    currency: LlmField = Field(default_factory=LlmField, description="Currency code or symbol as written")
    items: list[LlmItem] = Field(default_factory=list)
    subtotal: LlmField = Field(default_factory=LlmField, description="Printed subtotal; never computed")
    discount_amount: LlmField = Field(default_factory=LlmField, description="Printed discount; never computed")
    tax_amount: LlmField = Field(default_factory=LlmField, description="Printed tax amount; never computed")
    total_amount: LlmField = Field(default_factory=LlmField, description="Printed grand total; never computed")
    delivery_terms: LlmField = Field(default_factory=LlmField)
    delivery_days: LlmField = Field(default_factory=LlmField, description="Delivery lead time in days if stated")
    warranty_terms: LlmField = Field(default_factory=LlmField)
    warranty_months: LlmField = Field(default_factory=LlmField, description="Warranty period in months if stated")
    payment_terms: LlmField = Field(default_factory=LlmField)
