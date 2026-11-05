package com.vqms.comparison.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.UUID;

/** Latest validation of a quotation, from the Validation Service. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ValidationSummary(UUID id, UUID quotationId, Long quotationVersion, String status) {

    public boolean passed() {
        return "PASSED".equals(status);
    }

    /** Warnings only: eligible when configured, but a human must review the result. */
    public boolean needsReview() {
        return "NEEDS_REVIEW".equals(status);
    }
}
