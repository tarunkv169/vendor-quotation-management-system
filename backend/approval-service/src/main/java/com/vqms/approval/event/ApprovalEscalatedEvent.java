package com.vqms.approval.event;

import java.time.Instant;
import java.util.UUID;

/** A level missed its deadline (or was escalated manually) and is now also open to {@code escalationRole}. */
public record ApprovalEscalatedEvent(UUID eventId, String eventType, Instant occurredAt, String correlationId,
                                     UUID approvalId, String approvalNumber, UUID stepId, int levelNumber,
                                     String requiredRole, String escalationRole, Instant newDueAt, boolean automatic) {
}
