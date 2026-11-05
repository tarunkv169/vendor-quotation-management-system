package com.vqms.recommendation.dto.response;

import com.vqms.recommendation.enums.RecommendationCriteria;
import com.vqms.recommendation.enums.RecommendationStatus;
import com.vqms.recommendation.enums.RecommendationType;
import com.vqms.recommendation.enums.RiskLevel;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public record RecommendationResponse(
        UUID id,
        String recommendationNumber,
        UUID procurementRequestId,
        UUID comparisonId,
        String comparisonNumber,
        RecommendationStatus status,
        RecommendationType type,
        String policyCode,
        String currencyCode,
        Map<RecommendationCriteria, BigDecimal> criteriaWeights,
        List<RecommendationCriteria> excludedCriteria,
        UUID recommendedQuotationId,
        UUID recommendedVendorId,
        BigDecimal overallScore,
        RiskLevel riskLevel,
        boolean requiresReview,
        List<String> reviewReasons,
        UUID previousRecommendationId,
        Instant generatedAt,
        Instant submittedAt,
        UUID submittedBy,
        Long version
) {
}
