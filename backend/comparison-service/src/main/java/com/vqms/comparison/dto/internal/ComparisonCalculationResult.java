package com.vqms.comparison.dto.internal;

import com.vqms.comparison.entity.json.LineComparison;
import com.vqms.comparison.enums.ComparisonCriteria;
import com.vqms.comparison.enums.ComparisonResultType;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Outcome of one calculation run (pure data, persisted by the Comparison entity). */
public record ComparisonCalculationResult(
        String currencyCode,
        List<QuotationEvaluation> evaluations,
        List<LineComparison> lineComparisons,
        List<ComparisonCriteria> excludedCriteria,
        int eligibleCount,
        UUID lowestQuotationId,
        boolean requiresReview
) {

    public record QuotationEvaluation(
            UUID quotationId,
            UUID vendorId,
            String quotationNumber,
            UUID validationId,
            ComparisonResultType resultType,
            List<String> reasons,
            String currencyCode,
            BigDecimal subtotal,
            BigDecimal discountAmount,
            BigDecimal taxAmount,
            BigDecimal totalAmount,
            Integer maxDeliveryDays,
            Integer minWarrantyMonths,
            BigDecimal itemCoveragePercent,
            Map<ComparisonCriteria, BigDecimal> criterionScores,
            List<ComparisonCriteria> missingCriteria,
            BigDecimal overallScore,
            Integer rank,
            boolean lowestPrice,
            BigDecimal differenceFromLowest,
            BigDecimal differencePercent
    ) {
    }
}
