package com.vqms.recommendation.service.internal;

import com.vqms.recommendation.client.dto.ComparisonResults.VendorResult;
import com.vqms.recommendation.client.dto.ProcurementRequestInfo;
import com.vqms.recommendation.config.RecommendationProperties;
import com.vqms.recommendation.constants.RecommendationConstants;
import com.vqms.recommendation.dto.internal.RecommendationCalculationResult.RiskFactor;
import com.vqms.recommendation.enums.RiskLevel;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * Commercial and delivery risk, based only on available data (no invented vendor history):
 * <ul>
 *   <li>COMMERCIAL: abnormally low price vs the median of eligible quotations; total above budget.</li>
 *   <li>DELIVERY: delivery time missing or much slower than the fastest eligible quotation; incomplete coverage.</li>
 *   <li>INFORMATION: missing warranty or criteria without data (reported as missing, not as poor).</li>
 * </ul>
 * Risk level = the highest factor level (LOW when there are no factors).
 */
@Service
public class RiskAssessmentService {

    private static final BigDecimal TWO = BigDecimal.valueOf(2);

    private final RecommendationProperties properties;

    public RiskAssessmentService(RecommendationProperties properties) {
        this.properties = properties;
    }

    public List<RiskFactor> assess(VendorResult result, List<VendorResult> eligible, ProcurementRequestInfo request) {
        List<RiskFactor> factors = new ArrayList<>();
        BigDecimal total = result.totalAmount();

        BigDecimal median = median(eligible.stream().map(VendorResult::totalAmount).filter(Objects::nonNull).toList());
        if (total != null && median != null && eligible.size() >= 3) {
            BigDecimal threshold = median.multiply(RecommendationConstants.HUNDRED.subtract(
                    properties.abnormallyLowPricePercent())).divide(RecommendationConstants.HUNDRED, 4, RoundingMode.HALF_UP);
            if (total.compareTo(threshold) < 0) {
                factors.add(new RiskFactor("COMMERCIAL", RiskLevel.HIGH, "Price is more than "
                        + properties.abnormallyLowPricePercent().toPlainString()
                        + "% below the median of eligible quotations (possible abnormally low bid)"));
            }
        }
        if (total != null && request.budget() != null && request.budget().signum() > 0
                && total.compareTo(request.budget()) > 0) {
            factors.add(new RiskFactor("COMMERCIAL", RiskLevel.HIGH, "Total " + total.toPlainString()
                    + " exceeds the procurement budget " + request.budget().toPlainString()));
        }

        Integer fastest = eligible.stream().map(VendorResult::maxDeliveryDays).filter(Objects::nonNull)
                .min(Integer::compare).orElse(null);
        if (result.maxDeliveryDays() == null) {
            factors.add(new RiskFactor("DELIVERY", RiskLevel.MEDIUM, "Delivery time is not stated"));
        } else if (fastest != null && fastest > 0 && BigDecimal.valueOf(result.maxDeliveryDays())
                .compareTo(BigDecimal.valueOf(fastest).multiply(properties.slowDeliveryFactor())) > 0) {
            factors.add(new RiskFactor("DELIVERY", RiskLevel.MEDIUM, "Delivery (" + result.maxDeliveryDays()
                    + " days) is much slower than the fastest eligible offer (" + fastest + " days)"));
        }
        if (result.itemCoveragePercent() != null
                && result.itemCoveragePercent().compareTo(RecommendationConstants.HUNDRED) < 0) {
            factors.add(new RiskFactor("DELIVERY", RiskLevel.MEDIUM, "Only "
                    + result.itemCoveragePercent().stripTrailingZeros().toPlainString()
                    + "% of the requested items are fully quoted"));
        }

        if (result.minWarrantyMonths() == null) {
            factors.add(new RiskFactor("INFORMATION", RiskLevel.MEDIUM, "Warranty period is not stated"));
        }
        if (result.missingCriteria() != null && !result.missingCriteria().isEmpty()) {
            factors.add(new RiskFactor("INFORMATION", RiskLevel.MEDIUM,
                    "No data for criteria " + result.missingCriteria()));
        }
        return factors;
    }

    public static RiskLevel level(List<RiskFactor> factors) {
        return factors.stream().map(RiskFactor::level).reduce(RiskLevel.LOW, RiskLevel::max);
    }

    private static BigDecimal median(List<BigDecimal> values) {
        if (values.isEmpty()) {
            return null;
        }
        List<BigDecimal> sorted = values.stream().sorted().toList();
        int mid = sorted.size() / 2;
        return sorted.size() % 2 == 1 ? sorted.get(mid)
                : sorted.get(mid - 1).add(sorted.get(mid)).divide(TWO, 4, RoundingMode.HALF_UP);
    }
}
