package com.vqms.recommendation.calculator;

import com.vqms.recommendation.constants.RecommendationConstants;
import com.vqms.recommendation.enums.RecommendationCriteria;
import com.vqms.recommendation.exception.InvalidRecommendationException;

import java.math.BigDecimal;
import java.util.Map;

/** Weight validation shared by policies and requests. */
public final class CriteriaWeightCalculator {

    private CriteriaWeightCalculator() {
    }

    /** Weights must be present, non-negative and total exactly 100. */
    public static void validate(Map<RecommendationCriteria, BigDecimal> weights) {
        if (weights == null || weights.isEmpty()) {
            throw new InvalidRecommendationException("Criteria weights are required");
        }
        if (weights.values().stream().anyMatch(w -> w == null || w.signum() < 0)) {
            throw new InvalidRecommendationException("Criteria weights must not be negative");
        }
        BigDecimal sum = weights.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        if (sum.compareTo(RecommendationConstants.HUNDRED) != 0) {
            throw new InvalidRecommendationException("Criteria weights must total 100 (current total: "
                    + sum.stripTrailingZeros().toPlainString() + ")");
        }
    }
}
