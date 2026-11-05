package com.vqms.recommendation.policy;

import com.vqms.recommendation.enums.RecommendationCriteria;
import com.vqms.recommendation.enums.RiskLevel;

import java.math.BigDecimal;
import java.util.Map;

/**
 * Procurement-specific rules for turning comparison results into a recommendation.
 * Additional policies (e.g. "LOWEST_COMPLIANT_PRICE" for commodity purchases) are added as
 * new beans and selected by {@code policyCode}.
 */
public interface RecommendationPolicy {

    String code();

    /**
     * Weights to apply. {@code requested} are the weights given in the request (may be empty);
     * {@code comparisonWeights} are the weights the comparison used.
     */
    Map<RecommendationCriteria, BigDecimal> resolveWeights(Map<RecommendationCriteria, BigDecimal> requested,
                                                           Map<RecommendationCriteria, BigDecimal> comparisonWeights);

    /** Minimum weighted score (0-100) for a quotation to be recommended. */
    BigDecimal minimumOverallScore();

    /** Whether a quotation with this risk may be recommended at all. */
    boolean isAcceptableRisk(RiskLevel riskLevel);

    /** Whether a recommended quotation with this risk needs explicit human review. */
    boolean requiresReview(RiskLevel riskLevel);

    int maxAlternatives();
}
