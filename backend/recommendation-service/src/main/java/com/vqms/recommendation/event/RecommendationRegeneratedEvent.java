package com.vqms.recommendation.event;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** Published when a recommendation replaces a previous one (the previous one is SUPERSEDED). */
public record RecommendationRegeneratedEvent(
        UUID eventId,
        String eventType,
        Instant occurredAt,
        String correlationId,
        UUID recommendationId,
        String recommendationNumber,
        UUID previousRecommendationId,
        UUID comparisonId,
        UUID procurementRequestId,
        String recommendationType,
        UUID recommendedQuotationId,
        UUID recommendedVendorId,
        BigDecimal overallScore,
        String riskLevel,
        boolean requiresReview
) {
}
