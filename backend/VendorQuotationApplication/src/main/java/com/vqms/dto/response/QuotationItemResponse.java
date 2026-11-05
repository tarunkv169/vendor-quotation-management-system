package com.vqms.dto.response;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
public class QuotationItemResponse {

    private UUID id;
    private UUID quotationId;
    private String itemName;
    private String description;
    private Integer quantity;
    private String unit;
    private BigDecimal unitPrice;
    private BigDecimal lineTotal;
    private String currency;
    private String specification;
    private Integer deliveryDays;
    private BigDecimal confidenceScore;
    private Boolean manuallyVerified;
    private UUID verifiedBy;
    private LocalDateTime verifiedAt;
    private LocalDateTime createdAt;
}
