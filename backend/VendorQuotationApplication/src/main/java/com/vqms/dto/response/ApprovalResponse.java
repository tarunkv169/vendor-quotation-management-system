package com.vqms.dto.response;

import com.vqms.entity.ApprovalStatus;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
public class ApprovalResponse {

    private UUID id;
    private UUID purchaseRequestId;
    private UUID quotationId;
    private UUID approverId;
    private String approverName;
    private Integer approvalLevel;
    private String approvalRole;
    private ApprovalStatus status;
    private String decisionComment;
    private LocalDateTime decisionAt;
    private BigDecimal amount;
    private UUID delegatedTo;
    private LocalDateTime delegatedAt;
    private LocalDateTime dueDate;
    private UUID createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
