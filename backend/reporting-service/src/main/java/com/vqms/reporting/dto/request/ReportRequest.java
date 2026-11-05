package com.vqms.reporting.dto.request;

import com.vqms.reporting.enums.ReportType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Body of POST /api/v1/reports.
 * PROCUREMENT_SUMMARY needs {@code procurementRequestId}; APPROVAL_SPEND and VALIDATION_QUALITY need
 * {@code from}/{@code to} (inclusive dates, UTC). {@code currencyCode} optionally filters spend.
 */
public record ReportRequest(
        @NotNull ReportType type,
        UUID procurementRequestId,
        LocalDate from,
        LocalDate to,
        @Pattern(regexp = "^[A-Z]{3}$") String currencyCode
) {
}
