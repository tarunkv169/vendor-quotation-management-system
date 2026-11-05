package com.vqms.validation.dto.response;

import com.vqms.validation.enums.ValidationStatus;
import com.vqms.validation.enums.ValidationTrigger;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Validation report. {@code issues} is omitted in list responses. */
public record ValidationResponse(
        UUID id,
        UUID quotationId,
        String quotationNumber,
        Long quotationVersion,
        UUID vendorId,
        UUID procurementRequestId,
        UUID extractionId,
        UUID documentId,
        ValidationStatus status,
        ValidationTrigger trigger,
        UUID previousValidationId,
        String currencyCode,
        BigDecimal expectedSubtotal,
        BigDecimal expectedDiscount,
        BigDecimal expectedTax,
        BigDecimal expectedTotal,
        BigDecimal quotedTotal,
        int errorCount,
        int warningCount,
        int infoCount,
        String summary,
        Instant validatedAt,
        Instant createdAt,
        List<ValidationIssueResponse> issues
) {
}
