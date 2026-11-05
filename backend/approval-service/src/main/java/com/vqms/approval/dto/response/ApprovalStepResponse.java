package com.vqms.approval.dto.response;

import com.vqms.approval.enums.ApprovalLevel;
import com.vqms.approval.enums.ApprovalStepStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record ApprovalStepResponse(
        UUID id,
        int levelNumber,
        ApprovalLevel level,
        String requiredRole,
        BigDecimal approvalLimit,
        ApprovalStepStatus status,
        Instant activatedAt,
        Instant dueAt,
        boolean overdue,
        boolean escalated,
        String escalationRole,
        UUID decidedBy,
        UUID onBehalfOf,
        Instant decidedAt,
        String decisionComment
) {
}
