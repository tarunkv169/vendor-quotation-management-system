package com.vqms.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
public class ApprovalRequest {

    @NotNull(message = "Purchase request ID is required")
    private UUID purchaseRequestId;

    private UUID quotationId;

    @NotNull(message = "Approver ID is required")
    private UUID approverId;

    @NotNull(message = "Approval level is required")
    @Min(value = 1, message = "Approval level must be at least 1")
    private Integer approvalLevel;

    @NotBlank(message = "Approval role is required")
    @Size(max = 50, message = "Approval role cannot exceed 50 characters")
    private String approvalRole;

    private BigDecimal amount;

    private UUID delegatedTo;
}
