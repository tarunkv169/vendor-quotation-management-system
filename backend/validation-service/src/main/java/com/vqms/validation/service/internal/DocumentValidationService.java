package com.vqms.validation.service.internal;

import com.vqms.validation.client.dto.QuotationData;
import com.vqms.validation.client.dto.QuotationItemData;
import com.vqms.validation.dto.internal.IssueDraft;
import com.vqms.validation.dto.internal.ValidationContext;
import com.vqms.validation.dto.request.ExtractionPayload;
import com.vqms.validation.enums.ValidationType;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * DOCUMENT_VALIDATION: compares the AI extraction of the uploaded document with the quotation
 * values entered in the Quotation Service. Differences are WARNINGs for a human to resolve;
 * neither side is changed. Lines are matched by position (document order = quotation order).
 */
@Service
public class DocumentValidationService {

    private static final ValidationType TYPE = ValidationType.DOCUMENT_VALIDATION;
    private static final int MAX_EXTRACTION_ISSUES = 20;

    public List<IssueDraft> validate(ValidationContext context) {
        List<IssueDraft> issues = new ArrayList<>();
        if (context.extraction().isEmpty()) {
            return issues;
        }
        ExtractionPayload extraction = context.extraction().get();
        QuotationData q = context.quotation();

        if (Boolean.TRUE.equals(extraction.requiresHumanReview())) {
            issues.add(IssueDraft.warning(TYPE, "EXTRACTION_REQUIRES_REVIEW",
                    "The document extraction was flagged for human review", "extraction")
                    .withValues(null, extraction.overallConfidence()));
        }
        if (extraction.issues() != null) {
            extraction.issues().stream()
                    .filter(issue -> "ERROR".equalsIgnoreCase(issue.severity()))
                    .limit(MAX_EXTRACTION_ISSUES)
                    .forEach(issue -> issues.add(IssueDraft.warning(TYPE, "EXTRACTION_ISSUE",
                            "Extraction: " + issue.message(), issue.fieldPath())));
        }
        ExtractionPayload.ExtractedQuotation doc = extraction.quotation();
        if (doc == null) {
            return issues;
        }

        String docNumber = text(doc.quotationNumber());
        if (docNumber != null && q.quotationNumber() != null
                && !docNumber.trim().equalsIgnoreCase(q.quotationNumber().trim())) {
            issues.add(IssueDraft.info(TYPE, "DOC_QUOTATION_NUMBER_DIFFERS",
                    "Quotation number in the document differs from the system number", "quotationNumber")
                    .withValues(q.quotationNumber(), docNumber));
        }

        String docCurrency = doc.financials() == null ? null : text(doc.financials().currencyCode());
        if (docCurrency != null && q.currencyCode() != null
                && !docCurrency.trim().equalsIgnoreCase(q.currencyCode().trim())) {
            issues.add(IssueDraft.warning(TYPE, "DOC_CURRENCY_MISMATCH",
                    "Currency in the document differs from the quotation", "currencyCode")
                    .withValues(q.currencyCode(), docCurrency));
        }

        List<ExtractionPayload.Item> docItems = doc.items() == null ? List.of() : doc.items();
        List<QuotationItemData> items = q.safeItems();
        if (!docItems.isEmpty() && docItems.size() != items.size()) {
            issues.add(IssueDraft.warning(TYPE, "DOC_ITEM_COUNT_MISMATCH",
                    "Number of lines in the document differs from the quotation", "items")
                    .withValues(items.size(), docItems.size()));
        }
        int comparable = Math.min(docItems.size(), items.size());
        for (int i = 0; i < comparable; i++) {
            compareDecimal(issues, "DOC_QUANTITY_MISMATCH", "Quantity", "items[" + i + "].quantity",
                    items.get(i).quantity(), decimal(docItems.get(i).quantity()));
            compareDecimal(issues, "DOC_UNIT_PRICE_MISMATCH", "Unit price", "items[" + i + "].unitPrice",
                    items.get(i).unitPrice(), decimal(docItems.get(i).unitPrice()));
        }

        BigDecimal docTotal = doc.financials() == null ? null : decimal(doc.financials().totalAmountStated());
        compareDecimal(issues, "DOC_TOTAL_MISMATCH", "Total amount", "totalAmount", q.totalAmount(), docTotal);
        return issues;
    }

    private static void compareDecimal(List<IssueDraft> issues, String code, String label, String path,
                                       BigDecimal system, BigDecimal document) {
        if (system == null || document == null) {
            return;
        }
        int scale = Math.max(2, Math.min(system.scale(), 4));
        if (system.setScale(scale, RoundingMode.HALF_UP).compareTo(document.setScale(scale, RoundingMode.HALF_UP)) != 0) {
            issues.add(IssueDraft.warning(TYPE, code, label + " in the document differs from the quotation", path)
                    .withValues(system.toPlainString(), document.toPlainString()));
        }
    }

    private static String text(ExtractionPayload.Field field) {
        String value = field == null ? null : field.text();
        return value == null || value.isBlank() ? null : value.toUpperCase(Locale.ROOT).equals("NULL") ? null : value;
    }

    private static BigDecimal decimal(ExtractionPayload.Field field) {
        return field == null ? null : field.decimal();
    }
}
