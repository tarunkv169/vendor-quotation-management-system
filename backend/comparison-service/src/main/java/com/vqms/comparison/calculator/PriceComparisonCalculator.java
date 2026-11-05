package com.vqms.comparison.calculator;

import com.vqms.comparison.config.ComparisonProperties;
import com.vqms.comparison.constants.ComparisonConstants;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Price math on authoritative totals (BigDecimal only).
 *
 * <pre>
 * priceScore(q)        = lowestTotal / total(q) x 100     (lowest price = 100)
 * differenceFromLowest = total(q) - lowestTotal
 * differencePercent    = differenceFromLowest / lowestTotal x 100
 * </pre>
 */
@Component
public class PriceComparisonCalculator {

    private final int scale;

    public PriceComparisonCalculator(ComparisonProperties properties) {
        this.scale = properties.scoreScale();
    }

    public Optional<Map.Entry<UUID, BigDecimal>> lowest(Map<UUID, BigDecimal> totals) {
        return totals.entrySet().stream()
                .filter(e -> e.getValue() != null && e.getValue().signum() > 0)
                .min(Comparator.comparing((Map.Entry<UUID, BigDecimal> e) -> e.getValue())
                        .thenComparing(Map.Entry::getKey)); // tie-break on id keeps results deterministic
    }

    public Map<UUID, BigDecimal> priceScores(Map<UUID, BigDecimal> totals) {
        Map<UUID, BigDecimal> scores = new LinkedHashMap<>();
        BigDecimal lowest = lowest(totals).map(Map.Entry::getValue).orElse(null);
        totals.forEach((id, total) -> scores.put(id, lowest == null || total == null || total.signum() <= 0
                ? null
                : lowest.multiply(ComparisonConstants.HUNDRED).divide(total, scale, ComparisonProperties.ROUNDING)));
        return scores;
    }

    public BigDecimal differencePercent(BigDecimal total, BigDecimal lowest) {
        if (total == null || lowest == null || lowest.signum() <= 0) {
            return null;
        }
        return total.subtract(lowest).multiply(ComparisonConstants.HUNDRED)
                .divide(lowest, scale, ComparisonProperties.ROUNDING);
    }
}
