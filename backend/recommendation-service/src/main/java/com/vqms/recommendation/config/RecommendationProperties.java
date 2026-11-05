package com.vqms.recommendation.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Set;

/**
 * Default policy thresholds ({@code vqms.recommendation.*}).
 *
 * @param minimumOverallScore       a quotation below this weighted score is not recommended
 * @param abnormallyLowPricePercent price this far below the median of eligible quotations = HIGH risk
 * @param slowDeliveryFactor        delivery slower than fastest x factor = MEDIUM delivery risk
 */
@Validated
@ConfigurationProperties(prefix = "vqms.recommendation")
public record RecommendationProperties(
        @NotNull BigDecimal minimumOverallScore,
        @NotNull BigDecimal abnormallyLowPricePercent,
        @NotNull BigDecimal slowDeliveryFactor,
        @Min(0) @Max(5) int maxAlternatives,
        @Min(2) @Max(8) int scoreScale,
        // Latest validation statuses that keep a quotation eligible. NEEDS_REVIEW (warnings only) is accepted;
        // the comparison is then flagged for review, which makes the recommendation require review too.
        @NotEmpty Set<String> eligibleValidationStatuses
) {

    public static final RoundingMode ROUNDING = RoundingMode.HALF_UP;
}
