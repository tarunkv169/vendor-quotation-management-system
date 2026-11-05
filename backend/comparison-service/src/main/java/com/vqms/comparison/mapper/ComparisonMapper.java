package com.vqms.comparison.mapper;

import com.vqms.comparison.dto.response.ComparisonResponse;
import com.vqms.comparison.dto.response.ComparisonResultResponse;
import com.vqms.comparison.dto.response.VendorComparisonResponse;
import com.vqms.comparison.entity.Comparison;
import com.vqms.comparison.entity.ComparisonItem;
import com.vqms.comparison.enums.ComparisonResultType;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;

@Component
public class ComparisonMapper {

    public ComparisonResponse toResponse(Comparison c) {
        return new ComparisonResponse(c.getId(), c.getComparisonNumber(), c.getProcurementRequestId(), c.getStatus(),
                c.getCurrencyCode(), c.getCriteriaWeights(), c.getMinimumScores(), c.isRequireAllItems(),
                c.getExcludedCriteria(), c.getEligibleCount(), c.isRequiresReview(), c.isStale(),
                c.getLowestQuotationId(), c.getRecommendedQuotationId(), c.getFailureReason(), c.getCalculatedAt(),
                c.getCompletedAt(), c.getCreatedAt(), c.getVersion());
    }

    public VendorComparisonResponse toVendorResponse(ComparisonItem i) {
        return new VendorComparisonResponse(i.getRankPosition(), i.getQuotationId(), i.getQuotationNumber(),
                i.getVendorId(), i.getResultType(), i.getEligibilityReasons(), i.getCurrencyCode(), i.getTotalAmount(),
                i.getSubtotal(), i.getDiscountAmount(), i.getTaxAmount(), i.isLowestPrice(),
                i.getDifferenceFromLowest(), i.getDifferencePercent(), i.getMaxDeliveryDays(),
                i.getMinWarrantyMonths(), i.getItemCoveragePercent(), i.getCriterionScores(),
                i.getMissingCriteria(), i.getOverallScore());
    }

    public ComparisonResultResponse toResultResponse(Comparison c) {
        return new ComparisonResultResponse(toResponse(c), sorted(c.getItems(), false), c.getLineComparisons());
    }

    /** Ranked results first (by rank), then ineligible/incomparable ones. */
    public List<VendorComparisonResponse> sorted(List<ComparisonItem> items, boolean rankedOnly) {
        return items.stream()
                .filter(i -> !rankedOnly || i.getResultType() == ComparisonResultType.RANKED)
                .sorted(Comparator.comparing(ComparisonItem::getRankPosition,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .map(this::toVendorResponse)
                .toList();
    }
}
