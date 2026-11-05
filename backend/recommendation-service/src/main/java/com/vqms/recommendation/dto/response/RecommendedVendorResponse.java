package com.vqms.recommendation.dto.response;

import com.vqms.recommendation.dto.internal.RecommendationCalculationResult.RiskFactor;
import com.vqms.recommendation.enums.RecommendationCriteria;
import com.vqms.recommendation.enums.RecommendationRole;
import com.vqms.recommendation.enums.RiskLevel;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Ranking row: one quotation's evaluation in the recommendation. */
public record RecommendedVendorResponse(
        Integer rank,
        UUID quotationId,
        UUID vendorId,
        RecommendationRole role,
        boolean eligible,
        List<String> eligibilityReasons,
        BigDecimal totalAmount,
        Map<RecommendationCriteria, BigDecimal> criterionScores,
        List<RecommendationCriteria> missingCriteria,
        BigDecimal overallScore,
        RiskLevel riskLevel,
        List<RiskFactor> riskFactors
) {
}
