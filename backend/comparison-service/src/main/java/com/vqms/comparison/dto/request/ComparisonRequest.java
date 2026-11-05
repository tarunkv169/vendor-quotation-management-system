package com.vqms.comparison.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

/**
 * Body of POST /api/v1/comparisons.
 *
 * @param quotationIds    optional subset; default = all quotations of the procurement request
 * @param currencyCode    compare in this currency only; required when quotations use several currencies
 * @param requireAllItems mandatory technical requirement: quotations must cover every requested item in full
 */
public record ComparisonRequest(
        @NotNull UUID procurementRequestId,
        @NotEmpty @Size(max = 6) List<@Valid ComparisonCriteriaRequest> criteria,
        @Size(max = 100) List<UUID> quotationIds,
        @Pattern(regexp = "^[A-Z]{3}$", message = "currencyCode must be an ISO-4217 code") String currencyCode,
        boolean requireAllItems,
        @Size(max = 600) List<@Valid ManualScoreRequest> manualScores
) {
}
