package com.vqms.dto.response;

import com.vqms.entity.QuotationStatus;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
public class QuotationResponse {

    private UUID id;
    private UUID purchaseRequestId;
    private UUID vendorId;
    private String vendorName;
    private QuotationStatus status;
    private String fileName;
    private Long fileSize;
    private String contentType;
    private LocalDate quotationDate;
    private LocalDate validUntil;
    private LocalDate submissionDeadline;
    private Integer version;
    private BigDecimal totalAmount;
    private BigDecimal taxAmount;
    private BigDecimal discountAmount;
    private String paymentTerms;
    private Integer deliveryDays;
    private String warrantyPeriod;
    private String currency;
    private String notes;
    private BigDecimal extractionConfidence;
    private Integer processingAttempts;
    private LocalDateTime lastProcessingAt;
    private String processingError;
    private UUID reviewedBy;
    private LocalDateTime reviewedAt;
    private UUID submittedBy;
    private LocalDateTime submittedAt;
    private UUID createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<QuotationItemResponse> items;
}
