package com.vqms.recommendation.dto.internal;

import com.vqms.recommendation.enums.RecommendationCriteria;
import com.vqms.recommendation.enums.RecommendationRole;
import com.vqms.recommendation.enums.RecommendationType;
import com.vqms.recommendation.enums.RiskLevel;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Pure output of the recommendation engine, persisted by the Recommendation entity. */
public record RecommendationCalculationResult(
        RecommendationType type,
        Map<RecommendationCriteria, BigDecimal> weights,
        List<RecommendationCriteria> excludedCriteria,
        UUID recommendedQuotationId,
        UUID recommendedVendorId,
        BigDecimal overallScore,
        RiskLevel riskLevel,
        boolean requiresReview,
        List<String> reviewReasons,
        String explanation,
        List<Evaluation> evaluations
) {

    public record Evaluation(
            UUID quotationId,
            UUID vendorId,
            String label,
            boolean eligible,
            List<String> eligibilityReasons,
            RecommendationRole role,
            BigDecimal totalAmount,
            Map<RecommendationCriteria, BigDecimal> criterionScores,
            List<RecommendationCriteria> missingCriteria,
            BigDecimal overallScore,
            Integer rank,
            RiskLevel riskLevel,
            List<RiskFactor> riskFactors,
            String explanation
    ) {
    }

    /** One identified risk; category is COMMERCIAL, DELIVERY or INFORMATION. */
    public record RiskFactor(String category, RiskLevel level, String description) {
    }
}
