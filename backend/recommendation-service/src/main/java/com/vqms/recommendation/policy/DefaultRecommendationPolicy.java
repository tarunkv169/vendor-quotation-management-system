package com.vqms.recommendation.policy;

import com.vqms.recommendation.calculator.CriteriaWeightCalculator;
import com.vqms.recommendation.config.RecommendationProperties;
import com.vqms.recommendation.enums.RecommendationCriteria;
import com.vqms.recommendation.enums.RiskLevel;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Map;

/**
 * Default "best value" policy:
 * request weights override the comparison's weights; minimum score from configuration;
 * CRITICAL risk is never recommended; HIGH risk may be recommended but always needs review.
 */
@Component
public class DefaultRecommendationPolicy implements RecommendationPolicy {

    public static final String CODE = "DEFAULT";

    private final RecommendationProperties properties;

    public DefaultRecommendationPolicy(RecommendationProperties properties) {
        this.properties = properties;
    }

    @Override
    public String code() {
        return CODE;
    }

    @Override
    public Map<RecommendationCriteria, BigDecimal> resolveWeights(Map<RecommendationCriteria, BigDecimal> requested,
                                                                  Map<RecommendationCriteria, BigDecimal> comparisonWeights) {
        Map<RecommendationCriteria, BigDecimal> weights = requested != null && !requested.isEmpty()
                ? requested : comparisonWeights;
        CriteriaWeightCalculator.validate(weights);
        return weights;
    }

    @Override
    public BigDecimal minimumOverallScore() {
        return properties.minimumOverallScore();
    }

    @Override
    public boolean isAcceptableRisk(RiskLevel riskLevel) {
        return riskLevel != RiskLevel.CRITICAL;
    }

    @Override
    public boolean requiresReview(RiskLevel riskLevel) {
        return riskLevel == RiskLevel.HIGH || riskLevel == RiskLevel.CRITICAL;
    }

    @Override
    public int maxAlternatives() {
        return properties.maxAlternatives();
    }
}
