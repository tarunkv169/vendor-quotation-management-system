package com.vqms.approval.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** Recommendation data needed to open an approval (from the Recommendation Service). */
@JsonIgnoreProperties(ignoreUnknown = true)
public record RecommendationInfo(UUID id, String recommendationNumber, UUID comparisonId, UUID procurementRequestId,
                                 String status, String currencyCode, UUID recommendedQuotationId,
                                 UUID recommendedVendorId, String riskLevel, boolean requiresReview,
                                 List<String> reviewReasons, UUID submittedBy, BigDecimal recommendedTotalAmount) {
}
