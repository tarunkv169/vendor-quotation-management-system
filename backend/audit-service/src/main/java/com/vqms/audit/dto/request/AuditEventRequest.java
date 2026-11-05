package com.vqms.audit.dto.request;

import com.fasterxml.jackson.databind.JsonNode;
import com.vqms.audit.enums.AuditOutcome;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.UUID;

/**
 * Body of POST /api/v1/audit/events.
 * The source service is taken from the caller's token; {@code actorId}/{@code actorRole} are only
 * accepted from internal services (which report actions on behalf of users).
 *
 * @param eventId optional idempotency key; repeated submissions with the same id are recorded once
 */
public record AuditEventRequest(
        UUID eventId,
        @NotBlank @Size(max = 80) @Pattern(regexp = "^[A-Z0-9_.]+$") String eventType,
        @Size(max = 50) String aggregateType,
        UUID aggregateId,
        UUID actorId,
        @Size(max = 40) String actorRole,
        AuditOutcome outcome,
        @Size(max = 1000) String description,
        @PastOrPresent Instant occurredAt,
        JsonNode payload
) {
}
