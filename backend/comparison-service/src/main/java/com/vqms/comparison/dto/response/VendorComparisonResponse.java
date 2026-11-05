package com.vqms.comparison.dto.response;

import com.vqms.comparison.enums.ComparisonCriteria;
import com.vqms.comparison.enums.ComparisonResultType;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Result of one vendor's quotation in a comparison (ranking row). */
public record VendorComparisonResponse(
        Integer rank,
        UUID quotationId,
        String quotationNumber,
        UUID vendorId,
        ComparisonResultType resultType,
        List<String> eligibilityReasons,
        String currencyCode,
        BigDecimal totalAmount,
        BigDecimal subtotal,
        BigDecimal discountAmount,
        BigDecimal taxAmount,
        boolean lowestPrice,
        BigDecimal differenceFromLowest,
        BigDecimal differencePercent,
        Integer maxDeliveryDays,
        Integer minWarrantyMonths,
        BigDecimal itemCoveragePercent,
        Map<ComparisonCriteria, BigDecimal> criterionScores,
        List<ComparisonCriteria> missingCriteria,
        BigDecimal overallScore
) {
}
