package com.vqms.approval.event;

import java.time.Instant;
import java.util.UUID;

/** A further sequential level is now awaiting a decision (notification trigger). */
public record ApprovalStepActivatedEvent(UUID eventId, String eventType, Instant occurredAt, String correlationId,
                                         UUID approvalId, String approvalNumber, UUID stepId, int levelNumber,
                                         String requiredRole, Instant dueAt) {
}
