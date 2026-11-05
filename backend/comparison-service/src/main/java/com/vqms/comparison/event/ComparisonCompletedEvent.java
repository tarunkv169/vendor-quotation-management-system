package com.vqms.comparison.event;

import com.vqms.comparison.enums.ComparisonCriteria;
import com.vqms.comparison.enums.ComparisonResultType;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Published to vqms.comparison.events when a comparison is completed; consumed by the
 * Recommendation Service. Contains the full ranking so the recommendation can be explained
 * without re-calculating prices.
 */
public record ComparisonCompletedEvent(
        UUID eventId,
        String eventType,
        Instant occurredAt,
        String correlationId,
        UUID comparisonId,
        String comparisonNumber,
        UUID procurementRequestId,
        String currencyCode,
        Map<ComparisonCriteria, BigDecimal> criteriaWeights,
        List<ComparisonCriteria> excludedCriteria,
        boolean requiresReview,
        UUID lowestQuotationId,
        List<Ranking> rankings
) {

    public record Ranking(Integer rank, UUID quotationId, UUID vendorId, ComparisonResultType resultType,
                          List<String> eligibilityReasons, BigDecimal totalAmount, BigDecimal overallScore,
                          Map<ComparisonCriteria, BigDecimal> criterionScores, List<ComparisonCriteria> missingCriteria,
                          Integer maxDeliveryDays, Integer minWarrantyMonths, BigDecimal itemCoveragePercent,
                          boolean lowestPrice) {
    }
}
