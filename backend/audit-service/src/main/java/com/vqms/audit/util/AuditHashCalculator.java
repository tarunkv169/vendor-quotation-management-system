package com.vqms.audit.util;

import com.vqms.audit.entity.AuditEvent;
import com.vqms.audit.enums.AuditOutcome;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Objects;
import java.util.UUID;

/**
 * Deterministic SHA-256 over the canonical form of an audit record plus the previous hash.
 * Fields are joined with a unit-separator character and nulls are encoded explicitly, so two
 * different records can never produce the same input string.
 */
public final class AuditHashCalculator {

    private static final char SEPARATOR = '\u001F';

    private AuditHashCalculator() {
    }

    public static String hash(long sequence, UUID eventId, String sourceService, String eventType,
                              String aggregateType, UUID aggregateId, UUID actorId, String actorRole,
                              AuditOutcome outcome, String description, String correlationId, String payload,
                              Instant occurredAt, String previousHash) {
        String canonical = String.join(String.valueOf(SEPARATOR),
                String.valueOf(sequence), str(eventId), str(sourceService), str(eventType), str(aggregateType),
                str(aggregateId), str(actorId), str(actorRole), str(outcome), str(description), str(correlationId),
                str(payload), str(occurredAt), previousHash);
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(canonical.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 not available", ex);
        }
    }

    public static String hash(AuditEvent e) {
        return hash(e.getSequenceNumber(), e.getEventId(), e.getSourceService(), e.getEventType(),
                e.getAggregateType(), e.getAggregateId(), e.getActorId(), e.getActorRole(), e.getOutcome(),
                e.getDescription(), e.getCorrelationId(), e.getPayload(), e.getOccurredAt(), e.getPreviousHash());
    }

    private static String str(Object value) {
        return value == null ? "␀" : Objects.toString(value);
    }
}
