package com.vqms.dto.response;

import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
public class ComparisonLineResponse {

    private UUID id;
    private UUID comparisonId;
    private UUID quotationId;
    private String vendorName;
    private String itemName;
    private Integer quantity;
    private BigDecimal unitPrice;
    private BigDecimal totalPrice;
    private String currency;
    private Integer deliveryDays;
    private String validUntil;
    private String missingFields;
}
