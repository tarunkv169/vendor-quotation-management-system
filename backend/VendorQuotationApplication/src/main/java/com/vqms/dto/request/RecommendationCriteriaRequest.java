package com.vqms.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class RecommendationCriteriaRequest {

    @Min(value = 0, message = "Price weight must be >= 0")
    @Max(value = 100, message = "Price weight must be <= 100")
    private BigDecimal priceWeight = new BigDecimal("40");

    @Min(value = 0, message = "Delivery weight must be >= 0")
    @Max(value = 100, message = "Delivery weight must be <= 100")
    private BigDecimal deliveryWeight = new BigDecimal("25");

    @Min(value = 0, message = "Quality weight must be >= 0")
    @Max(value = 100, message = "Quality weight must be <= 100")
    private BigDecimal qualityWeight = new BigDecimal("20");

    @Min(value = 0, message = "Payment terms weight must be >= 0")
    @Max(value = 100, message = "Payment terms weight must be <= 100")
    private BigDecimal paymentTermsWeight = new BigDecimal("10");

    @Min(value = 0, message = "Vendor performance weight must be >= 0")
    @Max(value = 100, message = "Vendor performance weight must be <= 100")
    private BigDecimal vendorPerformanceWeight = new BigDecimal("5");
}
