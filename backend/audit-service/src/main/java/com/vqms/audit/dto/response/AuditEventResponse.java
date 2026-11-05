package com.vqms.audit.dto.response;

import com.vqms.audit.enums.AuditOutcome;

import java.time.Instant;
import java.util.UUID;

public record AuditEventResponse(
        UUID id,
        long sequenceNumber,
        UUID eventId,
        String sourceService,
        String eventType,
        String aggregateType,
        UUID aggregateId,
        UUID actorId,
        String actorRole,
        AuditOutcome outcome,
        String description,
        String correlationId,
        String payload,
        Instant occurredAt,
        Instant recordedAt,
        String hash
) {
}
