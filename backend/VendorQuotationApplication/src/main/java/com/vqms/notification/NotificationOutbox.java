package com.vqms.notification;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/**
 * One in-app notification waiting to be delivered to the Notification Service.
 * Written in the same transaction as the business change, so a notification exists
 * if and only if the change was committed; {@link NotificationRelay} delivers it afterwards.
 */
@Entity
@Table(name = "notification_outbox",
        indexes = @Index(name = "idx_notification_outbox_pending", columnList = "sent_at, next_attempt_at"))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class NotificationOutbox {

    @Id
    private UUID id;

    @Column(name = "recipient_user_id", nullable = false)
    private UUID recipientUserId;

    @Column(nullable = false, length = 40)
    private String category;

    @Column(nullable = false, length = 10)
    private String priority;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, length = 2000)
    private String message;

    @Column(name = "reference_type", length = 50)
    private String referenceType;

    @Column(name = "reference_id")
    private UUID referenceId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "next_attempt_at", nullable = false)
    private Instant nextAttemptAt;

    @Column(name = "sent_at")
    private Instant sentAt;

    @Column(nullable = false)
    private int attempts;

    @Column(name = "last_error", length = 500)
    private String lastError;

    NotificationOutbox(UUID recipientUserId, NotificationType type, String title, String message,
                       String referenceType, UUID referenceId) {
        this.id = UUID.randomUUID();
        this.recipientUserId = recipientUserId;
        this.category = type.category();
        this.priority = type.priority();
        this.title = truncate(title, 200);
        this.message = truncate(message, 2000);
        this.referenceType = referenceType;
        this.referenceId = referenceId;
        this.createdAt = Instant.now();
        this.nextAttemptAt = this.createdAt;
    }

    void markSent() {
        this.attempts++;
        this.sentAt = Instant.now();
        this.lastError = null;
    }

    /** Exponential back-off: 10s, 20s, 40s ... capped at 10 minutes. */
    void markFailed(String error) {
        this.attempts++;
        this.lastError = truncate(error, 500);
        long seconds = Math.min(600, 10L * (1L << Math.min(attempts - 1, 6)));
        this.nextAttemptAt = Instant.now().plus(Duration.ofSeconds(seconds));
    }

    private static String truncate(String value, int max) {
        return value == null || value.length() <= max ? value : value.substring(0, max - 1) + "…";
    }
}
