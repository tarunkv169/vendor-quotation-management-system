package com.vqms.validation.dto.request;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;

/**
 * Structured extraction produced by the AI Extraction Service (same camelCase JSON as its
 * ExtractionCompletedEvent). Values are untrusted: they are only compared against the
 * authoritative quotation, never copied into it.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ExtractionPayload(
        Boolean requiresHumanReview,
        BigDecimal overallConfidence,
        @Valid ExtractedQuotation quotation,
        @Size(max = 500) List<ExtractionIssue> issues
) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ExtractedQuotation(
            Field quotationNumber,
            Vendor vendor,
            @Size(max = 1000) List<Item> items,
            Financials financials
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Vendor(Field name, Field taxId) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Item(Integer lineNumber, Field productName, Field quantity, Field unit, Field unitPrice,
                       Field lineAmountStated) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Financials(Field currencyCode, Field totalAmountStated) {
    }

    /** {@code value} is a JSON string/number (Decimals arrive as strings, so no precision is lost). */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Field(JsonNode value, String rawText, Boolean ambiguous) {

        public String text() {
            return value == null || value.isNull() ? null : value.asText();
        }

        public BigDecimal decimal() {
            String text = text();
            if (text == null || text.isBlank()) {
                return null;
            }
            try {
                return new BigDecimal(text.trim());
            } catch (NumberFormatException ex) {
                return null;
            }
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ExtractionIssue(String fieldPath, String issueType, String severity, String message) {
    }
}
