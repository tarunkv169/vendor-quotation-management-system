package com.vqms.approval.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

/**
 * Inbox / idempotency record: the id of every consumed message is stored in the same
 * transaction as its effects, so a redelivered message is detected and skipped.
 */
@Entity
@Table(name = "processed_messages")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ProcessedMessage {

    @Id
    @Column(name = "message_id", nullable = false, updatable = false)
    private UUID messageId;

    @Column(name = "consumer", nullable = false, length = 80)
    private String consumer;

    @Column(name = "processed_at", nullable = false)
    private Instant processedAt;

    public ProcessedMessage(UUID messageId, String consumer) {
        this.messageId = messageId;
        this.consumer = consumer;
        this.processedAt = Instant.now();
    }
}
