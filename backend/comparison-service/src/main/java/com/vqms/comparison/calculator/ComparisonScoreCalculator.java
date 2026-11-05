package com.vqms.comparison.calculator;

import com.vqms.comparison.config.ComparisonProperties;
import com.vqms.comparison.constants.ComparisonConstants;
import com.vqms.comparison.enums.ComparisonCriteria;
import com.vqms.comparison.exception.InvalidComparisonException;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Normalized criterion scores (0-100) and the weighted overall score.
 *
 * <pre>
 * lower-is-better (delivery days): score = best / value x 100   (value 0 -> 100)
 * higher-is-better (warranty):     score = value / best x 100   (best 0 -> 100 for all)
 * overall = sum(weight_c x score_c) / sum(weight_c)   over the included criteria
 * </pre>
 * Re-dividing by the included weight total keeps the score on 0-100 when a criterion had to be
 * excluded for lack of data (the exclusion is reported, never hidden).
 */
@Component
public class ComparisonScoreCalculator {

    private final int scale;

    public ComparisonScoreCalculator(ComparisonProperties properties) {
        this.scale = properties.scoreScale();
    }

    /** Weights must be non-negative, unique per criterion and total exactly 100. */
    public static void validateWeights(Map<ComparisonCriteria, BigDecimal> weights) {
        if (weights.isEmpty()) {
            throw new InvalidComparisonException("At least one criterion weight is required");
        }
        BigDecimal sum = weights.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        if (sum.compareTo(ComparisonConstants.HUNDRED) != 0) {
            throw new InvalidComparisonException("Criteria weights must total 100 (current total: "
                    + sum.stripTrailingZeros().toPlainString() + ")");
        }
    }

    public Map<UUID, BigDecimal> lowerIsBetter(Map<UUID, Integer> values) {
        Integer best = values.values().stream().filter(Objects::nonNull).min(Integer::compare).orElse(null);
        Map<UUID, BigDecimal> scores = new LinkedHashMap<>();
        values.forEach((id, value) -> {
            if (value == null || best == null) {
                scores.put(id, null);
            } else if (value == 0) {
                scores.put(id, ComparisonConstants.HUNDRED.setScale(scale));
            } else {
                scores.put(id, BigDecimal.valueOf(best).multiply(ComparisonConstants.HUNDRED)
                        .divide(BigDecimal.valueOf(value), scale, ComparisonProperties.ROUNDING));
            }
        });
        return scores;
    }

    public Map<UUID, BigDecimal> higherIsBetter(Map<UUID, Integer> values) {
        Integer best = values.values().stream().filter(Objects::nonNull).max(Integer::compare).orElse(null);
        Map<UUID, BigDecimal> scores = new LinkedHashMap<>();
        values.forEach((id, value) -> {
            if (value == null || best == null) {
                scores.put(id, null);
            } else if (best == 0) {
                scores.put(id, ComparisonConstants.HUNDRED.setScale(scale));
            } else {
                scores.put(id, BigDecimal.valueOf(value).multiply(ComparisonConstants.HUNDRED)
                        .divide(BigDecimal.valueOf(best), scale, ComparisonProperties.ROUNDING));
            }
        });
        return scores;
    }

    public BigDecimal overall(Map<ComparisonCriteria, BigDecimal> scores, Map<ComparisonCriteria, BigDecimal> weights,
                              Collection<ComparisonCriteria> included) {
        BigDecimal weightTotal = BigDecimal.ZERO;
        BigDecimal weighted = BigDecimal.ZERO;
        for (ComparisonCriteria criterion : included) {
            BigDecimal weight = weights.getOrDefault(criterion, BigDecimal.ZERO);
            BigDecimal score = scores.get(criterion);
            if (weight.signum() == 0 || score == null) {
                continue;
            }
            weightTotal = weightTotal.add(weight);
            weighted = weighted.add(weight.multiply(score));
        }
        return weightTotal.signum() == 0 ? null : weighted.divide(weightTotal, scale, ComparisonProperties.ROUNDING);
    }
}
