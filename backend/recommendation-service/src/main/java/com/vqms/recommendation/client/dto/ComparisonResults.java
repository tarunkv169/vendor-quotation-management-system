package com.vqms.recommendation.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.vqms.recommendation.enums.RecommendationCriteria;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Authoritative comparison report from GET /api/v1/comparisons/{id}/results. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ComparisonResults(Header comparison, List<VendorResult> results) {

    public List<VendorResult> safeResults() {
        return results == null ? List.of() : results;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Header(UUID id, String comparisonNumber, UUID procurementRequestId, String status,
                         String currencyCode, Map<RecommendationCriteria, BigDecimal> criteriaWeights,
                         List<RecommendationCriteria> excludedCriteria, boolean requiresReview,
                         UUID lowestQuotationId) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record VendorResult(Integer rank, UUID quotationId, String quotationNumber, UUID vendorId,
                               String resultType, List<String> eligibilityReasons, BigDecimal totalAmount,
                               boolean lowestPrice, BigDecimal differencePercent, Integer maxDeliveryDays,
                               Integer minWarrantyMonths, BigDecimal itemCoveragePercent,
                               Map<RecommendationCriteria, BigDecimal> criterionScores,
                               List<RecommendationCriteria> missingCriteria, BigDecimal overallScore) {

        public boolean ranked() {
            return "RANKED".equals(resultType);
        }

        public String label() {
            return quotationNumber != null ? quotationNumber : String.valueOf(quotationId);
        }
    }
}
