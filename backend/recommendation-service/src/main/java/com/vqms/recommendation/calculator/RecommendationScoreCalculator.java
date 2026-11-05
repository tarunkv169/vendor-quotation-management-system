package com.vqms.recommendation.calculator;

import com.vqms.recommendation.config.RecommendationProperties;
import com.vqms.recommendation.enums.RecommendationCriteria;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.Map;

/**
 * Overall Score = sum(weight_c x score_c) / sum(weight_c) over the included criteria.
 * With all criteria included the divisor is 100, i.e. exactly "sum of weight x criterion score".
 * Criterion scores (0-100) come from the Comparison Service; nothing is recalculated here.
 */
@Component
public class RecommendationScoreCalculator {

    private final int scale;

    public RecommendationScoreCalculator(RecommendationProperties properties) {
        this.scale = properties.scoreScale();
    }

    public BigDecimal overall(Map<RecommendationCriteria, BigDecimal> scores,
                              Map<RecommendationCriteria, BigDecimal> weights,
                              Collection<RecommendationCriteria> included) {
        BigDecimal weightTotal = BigDecimal.ZERO;
        BigDecimal weighted = BigDecimal.ZERO;
        for (RecommendationCriteria criterion : included) {
            BigDecimal weight = weights.getOrDefault(criterion, BigDecimal.ZERO);
            BigDecimal score = scores == null ? null : scores.get(criterion);
            if (weight.signum() == 0 || score == null) {
                continue;
            }
            weightTotal = weightTotal.add(weight);
            weighted = weighted.add(weight.multiply(score));
        }
        return weightTotal.signum() == 0 ? null
                : weighted.divide(weightTotal, scale, RecommendationProperties.ROUNDING);
    }
}
