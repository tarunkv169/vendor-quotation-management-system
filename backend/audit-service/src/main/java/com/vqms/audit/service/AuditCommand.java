package com.vqms.audit.service;

import com.vqms.audit.enums.AuditOutcome;

import java.time.Instant;
import java.util.UUID;

/** Normalized input for appending one audit record (from the REST API). */
public record AuditCommand(UUID eventId, String sourceService, String eventType, String aggregateType,
                           UUID aggregateId, UUID actorId, String actorRole, AuditOutcome outcome,
                           String description, String correlationId, String payload, Instant occurredAt) {
}
