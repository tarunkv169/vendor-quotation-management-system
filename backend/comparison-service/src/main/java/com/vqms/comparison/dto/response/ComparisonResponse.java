package com.vqms.comparison.dto.response;

import com.vqms.comparison.enums.ComparisonCriteria;
import com.vqms.comparison.enums.ComparisonStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Comparison header: configuration and outcome summary. */
public record ComparisonResponse(
        UUID id,
        String comparisonNumber,
        UUID procurementRequestId,
        ComparisonStatus status,
        String currencyCode,
        Map<ComparisonCriteria, BigDecimal> criteriaWeights,
        Map<ComparisonCriteria, BigDecimal> minimumScores,
        boolean requireAllItems,
        List<ComparisonCriteria> excludedCriteria,
        int eligibleCount,
        boolean requiresReview,
        boolean stale,
        UUID lowestQuotationId,
        UUID recommendedQuotationId,
        String failureReason,
        Instant calculatedAt,
        Instant completedAt,
        Instant createdAt,
        Long version
) {
}
