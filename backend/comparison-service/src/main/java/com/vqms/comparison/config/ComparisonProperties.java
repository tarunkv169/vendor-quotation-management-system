package com.vqms.comparison.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.math.RoundingMode;
import java.util.Set;

/**
 * Comparison policy ({@code vqms.comparison.*}). Scores are 0-100 at {@code scoreScale} decimals,
 * HALF_UP. Weights are never configured here: each comparison carries its own procurement-specific weights.
 */
@Validated
@ConfigurationProperties(prefix = "vqms.comparison")
public record ComparisonProperties(
        @Min(1) int minimumEligibleQuotations,
        @Min(2) @Max(8) int scoreScale,
        @NotEmpty Set<String> comparableQuotationStatuses,
        // Latest validation statuses that make a quotation eligible. NEEDS_REVIEW (warnings only) is accepted but
        // flags the comparison for review; FAILED (errors) never qualifies.
        @NotEmpty Set<String> eligibleValidationStatuses
) {

    public static final RoundingMode ROUNDING = RoundingMode.HALF_UP;
}
