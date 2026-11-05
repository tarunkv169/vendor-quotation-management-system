package com.vqms.approval.dto.response;

import com.vqms.approval.enums.ApprovalMode;
import com.vqms.approval.enums.ApprovalStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ApprovalResponse(
        UUID id,
        String approvalNumber,
        UUID recommendationId,
        String recommendationNumber,
        UUID procurementRequestId,
        UUID quotationId,
        UUID vendorId,
        BigDecimal amount,
        String currencyCode,
        ApprovalStatus status,
        ApprovalMode mode,
        String policyCode,
        String riskLevel,
        boolean requiresReview,
        List<String> reviewReasons,
        UUID submittedBy,
        Instant decidedAt,
        String finalComment,
        Instant createdAt,
        Long version,
        List<ApprovalStepResponse> steps
) {
}
