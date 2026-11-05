package com.vqms.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Data
public class QuotationRequest {

    @NotNull(message = "Purchase request ID is required")
    private UUID purchaseRequestId;

    @NotNull(message = "Vendor ID is required")
    private UUID vendorId;

    @NotBlank(message = "Quotation date is required")
    private String quotationDate;

    private String validUntil;

    private String submissionDeadline;

    private String currency = "USD";

    private BigDecimal taxAmount;

    private BigDecimal discountAmount;

    @Size(max = 500, message = "Payment terms cannot exceed 500 characters")
    private String paymentTerms;

    @Min(value = 0, message = "Delivery days must be non-negative")
    private Integer deliveryDays;

    @Size(max = 200, message = "Warranty period cannot exceed 200 characters")
    private String warrantyPeriod;

    @Size(max = 5000, message = "Notes cannot exceed 5000 characters")
    private String notes;

    private List<QuotationItemRequest> items;
}
