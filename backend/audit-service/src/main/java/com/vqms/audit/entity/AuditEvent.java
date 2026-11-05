package com.vqms.audit.entity;

import com.vqms.audit.enums.AuditOutcome;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Immutable;

import java.time.Instant;
import java.util.UUID;

/**
 * One audit record. {@code @Immutable} tells Hibernate never to issue UPDATEs; the database trigger
 * additionally rejects UPDATE/DELETE. {@code hash} = SHA-256 over the record content and
 * {@code previousHash}, so any change or removal breaks the chain (see AuditHashCalculator).
 */
@Entity
@Immutable
@Table(name = "audit_events")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AuditEvent {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "sequence_number", nullable = false, updatable = false)
    private long sequenceNumber;

    /** Idempotency key: the same event is never recorded twice. */
    @Column(name = "event_id", nullable = false, updatable = false)
    private UUID eventId;

    @Column(name = "source_service", nullable = false, length = 60, updatable = false)
    private String sourceService;

    @Column(name = "event_type", nullable = false, length = 80, updatable = false)
    private String eventType;

    @Column(name = "aggregate_type", length = 50, updatable = false)
    private String aggregateType;

    @Column(name = "aggregate_id", updatable = false)
    private UUID aggregateId;

    @Column(name = "actor_id", updatable = false)
    private UUID actorId;

    @Column(name = "actor_role", length = 40, updatable = false)
    private String actorRole;

    @Enumerated(EnumType.STRING)
    @Column(name = "outcome", nullable = false, length = 20, updatable = false)
    private AuditOutcome outcome;

    @Column(name = "description", length = 1000, updatable = false)
    private String description;

    @Column(name = "correlation_id", length = 64, updatable = false)
    private String correlationId;

    @Column(name = "payload", columnDefinition = "text", updatable = false)
    private String payload;

    @Column(name = "occurred_at", nullable = false, updatable = false)
    private Instant occurredAt;

    @Column(name = "recorded_at", nullable = false, updatable = false)
    private Instant recordedAt;

    @Column(name = "previous_hash", nullable = false, length = 64, updatable = false)
    private String previousHash;

    @Column(name = "hash", nullable = false, length = 64, updatable = false)
    private String hash;

    @Builder
    private AuditEvent(UUID id, long sequenceNumber, UUID eventId, String sourceService, String eventType,
                       String aggregateType, UUID aggregateId, UUID actorId, String actorRole, AuditOutcome outcome,
                       String description, String correlationId, String payload, Instant occurredAt,
                       Instant recordedAt, String previousHash, String hash) {
        this.id = id;
        this.sequenceNumber = sequenceNumber;
        this.eventId = eventId;
        this.sourceService = sourceService;
        this.eventType = eventType;
        this.aggregateType = aggregateType;
        this.aggregateId = aggregateId;
        this.actorId = actorId;
        this.actorRole = actorRole;
        this.outcome = outcome;
        this.description = description;
        this.correlationId = correlationId;
        this.payload = payload;
        this.occurredAt = occurredAt;
        this.recordedAt = recordedAt;
        this.previousHash = previousHash;
        this.hash = hash;
    }
}
