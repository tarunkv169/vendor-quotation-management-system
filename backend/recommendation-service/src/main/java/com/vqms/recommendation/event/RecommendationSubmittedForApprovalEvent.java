package com.vqms.recommendation.event;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Hand-over to the Approval Service. Carries the amount and currency so approval limits can be
 * applied, plus the submitter so self-approval can be prevented there.
 */
public record RecommendationSubmittedForApprovalEvent(
        UUID eventId,
        String eventType,
        Instant occurredAt,
        String correlationId,
        UUID recommendationId,
        String recommendationNumber,
        UUID comparisonId,
        UUID procurementRequestId,
        UUID recommendedQuotationId,
        UUID recommendedVendorId,
        BigDecimal recommendedTotalAmount,
        String currencyCode,
        BigDecimal overallScore,
        String riskLevel,
        boolean requiresReview,
        List<String> reviewReasons,
        List<UUID> alternativeQuotationIds,
        String explanation,
        UUID submittedBy,
        String submissionComment
) {
}
