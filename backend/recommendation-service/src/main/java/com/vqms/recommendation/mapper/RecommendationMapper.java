package com.vqms.recommendation.mapper;

import com.vqms.recommendation.dto.response.RecommendationExplanationResponse;
import com.vqms.recommendation.dto.response.RecommendationResponse;
import com.vqms.recommendation.dto.response.RecommendedVendorResponse;
import com.vqms.recommendation.entity.Recommendation;
import com.vqms.recommendation.entity.RecommendationItem;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;

@Component
public class RecommendationMapper {

    public RecommendationResponse toResponse(Recommendation r) {
        return new RecommendationResponse(r.getId(), r.getRecommendationNumber(), r.getProcurementRequestId(),
                r.getComparisonId(), r.getComparisonNumber(), r.getStatus(), r.getType(), r.getPolicyCode(),
                r.getCurrencyCode(), r.getCriteriaWeights(), r.getExcludedCriteria(), r.getRecommendedQuotationId(),
                r.getRecommendedVendorId(), r.getOverallScore(), r.getRiskLevel(), r.isRequiresReview(),
                r.getReviewReasons(), r.getPreviousRecommendationId(), r.getGeneratedAt(), r.getSubmittedAt(),
                r.getSubmittedBy(), r.getVersion());
    }

    public List<RecommendedVendorResponse> toRanking(Recommendation r) {
        return sortedItems(r).stream()
                .map(i -> new RecommendedVendorResponse(i.getRankPosition(), i.getQuotationId(), i.getVendorId(),
                        i.getRole(), i.isEligible(), i.getEligibilityReasons(), i.getTotalAmount(),
                        i.getCriterionScores(), i.getMissingCriteria(), i.getOverallScore(), i.getRiskLevel(),
                        i.getRiskFactors()))
                .toList();
    }

    public RecommendationExplanationResponse toExplanation(Recommendation r) {
        return new RecommendationExplanationResponse(r.getId(), r.getExplanation(), r.getReviewReasons(),
                sortedItems(r).stream()
                        .map(i -> new RecommendationExplanationResponse.ItemExplanation(i.getQuotationId(),
                                i.getRankPosition(), i.getExplanation()))
                        .toList());
    }

    private static List<RecommendationItem> sortedItems(Recommendation r) {
        return r.getItems().stream()
                .sorted(Comparator.comparing(RecommendationItem::getRankPosition,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
    }
}
