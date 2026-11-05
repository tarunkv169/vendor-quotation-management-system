package com.vqms.approval.event;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Approval opened; {@code pendingLevels} tell the Notification Service whom to notify. */
public record ApprovalCreatedEvent(UUID eventId, String eventType, Instant occurredAt, String correlationId,
                                   UUID approvalId, String approvalNumber, UUID recommendationId,
                                   UUID procurementRequestId, UUID quotationId, UUID vendorId, BigDecimal amount,
                                   String currencyCode, String policyCode, String mode, List<PendingLevel> pendingLevels) {

    public record PendingLevel(int levelNumber, String requiredRole, Instant dueAt) {
    }
}
