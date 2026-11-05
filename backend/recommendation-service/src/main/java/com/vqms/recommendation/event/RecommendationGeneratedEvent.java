package com.vqms.recommendation.event;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** Published when a recommendation is generated (outbox channel vqms.recommendation.events). */
public record RecommendationGeneratedEvent(
        UUID eventId,
        String eventType,
        Instant occurredAt,
        String correlationId,
        UUID recommendationId,
        String recommendationNumber,
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
