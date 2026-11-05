package com.vqms.dto.response;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
public class RecommendationResponse {

    private UUID id;
    private UUID purchaseRequestId;
    private UUID recommendedVendorId;
    private String recommendedVendorName;
    private UUID recommendedQuotationId;
    private BigDecimal recommendationScore;
    private BigDecimal priceScore;
    private BigDecimal qualityScore;
    private BigDecimal deliveryScore;
    private String explanation;
    private String criteriaJson;
    private UUID createdBy;
    private LocalDateTime createdAt;
}
