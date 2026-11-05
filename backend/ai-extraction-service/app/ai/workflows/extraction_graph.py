"""LangGraph extraction workflow.

    document_classification_node
              │
       text_extraction_node ──(pages need OCR?)──► ocr_node
              │                                       │
              └──────────► text_normalization_node ◄──┘
                                   │
                     quotation_extraction_node ◄──────────┐
                                   │                      │ (invalid output, attempts left)
                        structured_output_node ───────────┤
                                   │ (parsed)             │ (no attempts left)
                     confidence_assessment_node           │
                                   │                      │
                     extraction_validation_node           │
                                   │                      │
                              result_node ◄───────────────┘

Each node is a plain function `state -> partial state`. Parsing (PyMuPDF/openpyxl/OCR) is
kept in `app.parsers` / `app.services`, so this module only orchestrates.
The graph is synchronous; the extraction service runs it in a worker thread.
"""
from __future__ import annotations

import logging
import re
import unicodedata
from collections.abc import Callable, Iterator
from datetime import date
from decimal import Decimal
from typing import Any

from langchain_core.runnables import Runnable
from langgraph.graph import END, StateGraph
from pydantic import BaseModel

from app.ai.prompts.quotation_extraction_prompt import build_messages
from app.ai.workflows.extraction_state import ExtractionState, PageText
from app.config.settings import Settings
from app.exceptions.extraction_exceptions import (
    LlmExtractionError,
    LlmOutputError,
    OcrError,
    UnsupportedDocumentError,
)
from app.parsers.document_classifier import classify
from app.parsers.excel_parser import extract_workbook
from app.parsers.pdf_parser import extract_pdf, render_pages_for_ocr
from app.schemas.llm_output import LlmField, LlmItem, LlmQuotation
from app.schemas.quotation_schema import (
    DocumentFormat,
    ExtractedField,
    ExtractedFieldEvidence,
    ExtractedFinancialInformation,
    ExtractedQuotationItem,
    ExtractedVendorInformation,
    ExtractionStatus,
    MissingField,
    QuotationExtraction,
)
from app.services.confidence_service import ConfidenceService, SourceIndex
from app.services.ocr_service import OcrService
from app.utils.metrics import LLM_CALLS_TOTAL, LLM_TOKENS_TOTAL
from app.utils.value_parsers import normalize_currency, parse_date, parse_decimal, parse_int

log = logging.getLogger(__name__)

_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f​-‏⁠﻿]")
_SPACES = re.compile(r"[ \t]+")
_BLANK_LINES = re.compile(r"\n{3,}")
_MAX_RAW = 500
_MAX_EVIDENCE = 500


def _clean(text: str) -> str:
    text = unicodedata.normalize("NFKC", text)
    text = _CONTROL.sub("", text)
    text = "\n".join(_SPACES.sub(" ", line).strip() for line in text.splitlines())
    return _BLANK_LINES.sub("\n\n", text).strip()


def _clip(text: str | None, limit: int) -> str | None:
    if text is None:
        return None
    text = text.strip()
    return text[:limit] if text else None


def iter_fields(model: BaseModel) -> Iterator[ExtractedField]:
    """Yields every ExtractedField inside a (nested) quotation model."""
    for name in type(model).model_fields:
        value = getattr(model, name)
        if isinstance(value, ExtractedField):
            yield value
        elif isinstance(value, BaseModel):
            yield from iter_fields(value)
        elif isinstance(value, list):
            for element in value:
                if isinstance(element, BaseModel):
                    yield from iter_fields(element)


def build_extraction_graph(settings: Settings, extractor: Runnable, ocr_service: OcrService,
                           confidence_service: ConfidenceService) -> Any:
    """Builds and compiles the workflow. Dependencies are captured by the node closures."""

    # ------------------------------------------------------------------ nodes

    def document_classification_node(state: ExtractionState) -> dict:
        document_format = classify(state["document_bytes"], state.get("declared_content_type"))
        log.info("Document classified as %s", document_format.value)
        return {"document_format": document_format, "issues": [], "llm_attempts": 0, "llm_usage": {}}

    def text_extraction_node(state: ExtractionState) -> dict:
        data, document_format = state["document_bytes"], state["document_format"]
        issues = list(state.get("issues", []))

        if document_format == DocumentFormat.PDF:
            content = extract_pdf(data, settings.max_pdf_pages)
            pages = [PageText(page=p.page_number, label="Page", text=p.text, tables=p.tables, from_ocr=False)
                     for p in content.pages]
            ocr_pages = [p.page_number for p in content.pages
                         if p.char_count < settings.ocr_min_text_chars_per_page]
            return {"pages": pages, "ocr_page_numbers": ocr_pages, "used_ocr": False}

        if document_format == DocumentFormat.XLSX:
            sheets = extract_workbook(data, settings.max_excel_rows, settings.max_excel_columns)
            pages = [PageText(page=s.sheet_number, label=f"Sheet {s.sheet_number} ({s.name})", text="",
                              tables=[s.rows], from_ocr=False) for s in sheets]
            for sheet in sheets:
                if sheet.truncated:
                    issues.append(MissingField(field_path=f"sheet[{sheet.sheet_number}]", issue_type="TRUNCATED",
                                               severity="WARNING",
                                               message=f"Sheet '{sheet.name}' exceeded the row limit"))
            return {"pages": pages, "ocr_page_numbers": [], "used_ocr": False, "issues": issues}

        # IMAGE: everything comes from OCR.
        return {"pages": [PageText(page=1, label="Page", text="", tables=[], from_ocr=True)],
                "ocr_page_numbers": [1], "used_ocr": False}

    def ocr_node(state: ExtractionState) -> dict:
        data, document_format = state["document_bytes"], state["document_format"]
        numbers = state["ocr_page_numbers"]
        images = {1: data} if document_format == DocumentFormat.IMAGE else \
            render_pages_for_ocr(data, numbers, settings.ocr_dpi)

        pages = {p["page"]: dict(p) for p in state["pages"]}
        confidences: list[Decimal] = []
        failures = 0
        for number, image in images.items():
            try:
                result = ocr_service.recognize(image)
            except OcrError as exc:
                failures += 1
                log.warning("OCR failed on page %s: %s", number, exc.message)
                continue
            if len(result.text.strip()) > len(pages[number]["text"].strip()):
                pages[number]["text"] = result.text
                pages[number]["from_ocr"] = True
                confidences.append(result.mean_confidence)

        merged = [PageText(**p) for _, p in sorted(pages.items())]
        if failures == len(images) and not any(p["text"].strip() for p in merged):
            raise OcrError("OCR failed and the document has no readable native text")

        mean = (sum(confidences) / len(confidences)).quantize(Decimal("0.001")) if confidences else None
        new_format = DocumentFormat.SCANNED_PDF if document_format == DocumentFormat.PDF and confidences \
            else document_format
        return {"pages": merged, "used_ocr": bool(confidences), "ocr_mean_confidence": mean,
                "document_format": new_format}

    def text_normalization_node(state: ExtractionState) -> dict:
        parts: list[str] = []
        has_content = False
        for page in state["pages"]:
            header = f"=== Page {page['page']} ===" if page["label"] == "Page" else f"=== {page['label']} ==="
            body = _clean(page["text"])
            table_lines = [" | ".join(_clean(cell) for cell in row)
                           for table in page["tables"] for row in table if any(row)]
            content = "\n".join(filter(None, [body, "\n".join(table_lines)]))
            has_content = has_content or bool(content.strip())
            parts.append(f"{header}\n{content}")
        if not has_content:
            raise UnsupportedDocumentError("No readable text could be extracted from the document")

        text = "\n\n".join(parts)
        issues = list(state.get("issues", []))
        truncated = len(text) > settings.max_llm_input_chars
        if truncated:
            text = text[: settings.max_llm_input_chars]
            issues.append(MissingField(field_path="document", issue_type="TRUNCATED", severity="WARNING",
                                       message="Document text exceeded the processing limit and was truncated"))
        return {"source_text": text, "source_truncated": truncated, "issues": issues}

    def quotation_extraction_node(state: ExtractionState) -> dict:
        attempts = state.get("llm_attempts", 0) + 1
        messages = build_messages(state["source_text"], state["document_format"].value)
        provider = settings.llm_provider
        try:
            result = extractor.invoke(messages)
        except Exception as exc:  # provider SDKs raise many types; all are treated as transient
            LLM_CALLS_TOTAL.labels(provider=provider, outcome="error").inc()
            log.warning("LLM call failed (attempt %s): %s", attempts, type(exc).__name__)
            if attempts >= settings.llm_max_attempts:
                raise LlmExtractionError(f"LLM call failed after {attempts} attempts: {type(exc).__name__}") from exc
            return {"llm_attempts": attempts, "llm_output": None, "llm_error": type(exc).__name__}

        usage = dict(state.get("llm_usage") or {})
        metadata = getattr(result.get("raw"), "usage_metadata", None) or {}
        usage["input_tokens"] = usage.get("input_tokens", 0) + int(metadata.get("input_tokens", 0))
        usage["output_tokens"] = usage.get("output_tokens", 0) + int(metadata.get("output_tokens", 0))
        LLM_TOKENS_TOTAL.labels(provider=provider, model=settings.llm_model, direction="input") \
            .inc(int(metadata.get("input_tokens", 0)))
        LLM_TOKENS_TOTAL.labels(provider=provider, model=settings.llm_model, direction="output") \
            .inc(int(metadata.get("output_tokens", 0)))

        parsed = result.get("parsed")
        if parsed is None:
            LLM_CALLS_TOTAL.labels(provider=provider, outcome="invalid_output").inc()
            error = str(result.get("parsing_error") or "no structured output")[:300]
            log.warning("LLM returned invalid structured output (attempt %s)", attempts)
            return {"llm_attempts": attempts, "llm_output": None, "llm_error": error, "llm_usage": usage}

        LLM_CALLS_TOTAL.labels(provider=provider, outcome="success").inc()
        return {"llm_attempts": attempts, "llm_output": parsed, "llm_error": None, "llm_usage": usage}

    def structured_output_node(state: ExtractionState) -> dict:
        output: LlmQuotation | None = state.get("llm_output")
        if output is None:
            return {"quotation": None}
        builder = _FieldBuilder(SourceIndex(state["source_text"]), state["pages"], state["document_format"],
                                settings.date_day_first)
        return {"quotation": builder.build(output)}

    def confidence_assessment_node(state: ExtractionState) -> dict:
        quotation = state["quotation"]
        source = SourceIndex(state["source_text"])
        for field in iter_fields(quotation):
            from_ocr = field.evidence is not None and field.evidence.extraction_method == "OCR"
            confidence_service.score_field(field, source, from_ocr, state.get("ocr_mean_confidence"))
        return {"quotation": quotation}

    def extraction_validation_node(state: ExtractionState) -> dict:
        quotation = state["quotation"]
        issues = list(state.get("issues", [])) + confidence_service.find_issues(quotation)
        overall = confidence_service.overall_confidence(quotation)
        requires_review = (
            any(issue.severity == "ERROR" for issue in issues)
            or overall < settings.confidence_review_threshold
        )
        return {"issues": issues, "overall_confidence": overall, "requires_human_review": requires_review}

    def result_node(state: ExtractionState) -> dict:
        if state.get("quotation") is None:
            raise LlmOutputError(
                f"LLM did not return valid structured output after {state.get('llm_attempts', 0)} attempts")
        status = ExtractionStatus.NEEDS_REVIEW if state["requires_human_review"] else ExtractionStatus.COMPLETED
        return {"status": status}

    # ------------------------------------------------------------------ routing

    def route_after_text_extraction(state: ExtractionState) -> str:
        return "ocr_node" if state.get("ocr_page_numbers") else "text_normalization_node"

    def route_after_structured_output(state: ExtractionState) -> str:
        if state.get("quotation") is not None:
            return "confidence_assessment_node"
        if state.get("llm_attempts", 0) < settings.llm_max_attempts:
            return "quotation_extraction_node"
        return "result_node"

    graph = StateGraph(ExtractionState)
    graph.add_node("document_classification_node", document_classification_node)
    graph.add_node("text_extraction_node", text_extraction_node)
    graph.add_node("ocr_node", ocr_node)
    graph.add_node("text_normalization_node", text_normalization_node)
    graph.add_node("quotation_extraction_node", quotation_extraction_node)
    graph.add_node("structured_output_node", structured_output_node)
    graph.add_node("confidence_assessment_node", confidence_assessment_node)
    graph.add_node("extraction_validation_node", extraction_validation_node)
    graph.add_node("result_node", result_node)

    graph.set_entry_point("document_classification_node")
    graph.add_edge("document_classification_node", "text_extraction_node")
    graph.add_conditional_edges("text_extraction_node", route_after_text_extraction,
                                ["ocr_node", "text_normalization_node"])
    graph.add_edge("ocr_node", "text_normalization_node")
    graph.add_edge("text_normalization_node", "quotation_extraction_node")
    graph.add_edge("quotation_extraction_node", "structured_output_node")
    graph.add_conditional_edges("structured_output_node", route_after_structured_output,
                                ["quotation_extraction_node", "confidence_assessment_node", "result_node"])
    graph.add_edge("confidence_assessment_node", "extraction_validation_node")
    graph.add_edge("extraction_validation_node", "result_node")
    graph.add_edge("result_node", END)
    return graph.compile()


class _FieldBuilder:
    """Turns raw LLM strings into validated, typed fields with located evidence."""

    def __init__(self, source: SourceIndex, pages: list[PageText], document_format: DocumentFormat,
                 day_first: bool) -> None:
        self._source = source
        self._ocr_pages = {p["page"] for p in pages if p["from_ocr"]}
        self._spreadsheet = document_format == DocumentFormat.XLSX
        self._day_first = day_first

    def _method(self, page: int | None) -> str:
        if self._spreadsheet:
            return "SPREADSHEET"
        if page in self._ocr_pages or (page is None and self._ocr_pages):
            return "OCR"
        return "NATIVE_TEXT"

    def _field(self, cls: type, llm: LlmField, parser: Callable[[str], tuple[Any, bool]]) -> ExtractedField:
        raw = _clip(llm.value, _MAX_RAW)
        if raw is None:
            return cls()
        value, ambiguous = parser(raw)
        page = llm.page if llm.page and llm.page >= 1 else None
        evidence = ExtractedFieldEvidence(
            source_text=_clip(llm.evidence, _MAX_EVIDENCE),
            page=page,
            extraction_method=self._method(page),
            found_in_source=self._source.contains(llm.evidence),
        )
        return cls(value=value, raw_text=raw, evidence=evidence, ambiguous=ambiguous or llm.ambiguous)

    def _text(self, llm: LlmField) -> ExtractedField:
        return self._field(ExtractedField[str], llm, lambda t: (t, False))

    def _decimal(self, llm: LlmField, positive: bool = False) -> ExtractedField:
        def parse(text: str) -> tuple[Decimal | None, bool]:
            value, ambiguous = parse_decimal(text)
            if positive and value is not None and value <= 0:
                ambiguous = True
            return value, ambiguous
        return self._field(ExtractedField[Decimal], llm, parse)

    def _int(self, llm: LlmField) -> ExtractedField:
        return self._field(ExtractedField[int], llm, parse_int)

    def _date(self, llm: LlmField) -> ExtractedField:
        return self._field(ExtractedField[date], llm, lambda t: parse_date(t, self._day_first))

    def _item(self, number: int, item: LlmItem) -> ExtractedQuotationItem:
        return ExtractedQuotationItem(
            line_number=number,
            product_name=self._text(item.product_name),
            description=self._text(item.description),
            quantity=self._decimal(item.quantity, positive=True),
            unit=self._text(item.unit),
            unit_price=self._decimal(item.unit_price, positive=True),
            tax_rate_percent=self._decimal(item.tax_rate_percent),
            discount_rate_percent=self._decimal(item.discount_rate_percent),
            line_amount_stated=self._decimal(item.line_amount),
        )

    def build(self, output: LlmQuotation) -> QuotationExtraction:
        return QuotationExtraction(
            quotation_number=self._text(output.quotation_number),
            quotation_date=self._date(output.quotation_date),
            valid_until=self._date(output.valid_until),
            vendor=ExtractedVendorInformation(
                name=self._text(output.vendor_name),
                tax_id=self._text(output.vendor_tax_id),
                email=self._text(output.vendor_email),
                phone=self._text(output.vendor_phone),
                address=self._text(output.vendor_address),
            ),
            items=[self._item(i, item) for i, item in enumerate(output.items[:1000], start=1)],
            financials=ExtractedFinancialInformation(
                currency_code=self._field(ExtractedField[str], output.currency, normalize_currency),
                subtotal_stated=self._decimal(output.subtotal),
                discount_amount_stated=self._decimal(output.discount_amount),
                tax_amount_stated=self._decimal(output.tax_amount),
                total_amount_stated=self._decimal(output.total_amount),
            ),
            delivery_terms=self._text(output.delivery_terms),
            delivery_days=self._int(output.delivery_days),
            warranty_terms=self._text(output.warranty_terms),
            warranty_months=self._int(output.warranty_months),
            payment_terms=self._text(output.payment_terms),
        )
