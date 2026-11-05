package com.vqms.notification.entity;

import com.vqms.notification.entity.base.BaseEntity;
import com.vqms.notification.enums.EmailStatus;
import com.vqms.notification.enums.NotificationCategory;
import com.vqms.notification.enums.NotificationPriority;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * A notification for exactly one target: a specific user, or every user holding a role
 * (e.g. "all PROCUREMENT_MANAGERs: approval awaiting decision"). Read state is per user (NotificationRead).
 */
@Entity
@Table(name = "notifications")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Notification extends BaseEntity {

    @Column(name = "recipient_user_id")
    private UUID recipientUserId;

    @Column(name = "recipient_role", length = 40)
    private String recipientRole;

    @Enumerated(EnumType.STRING)
    @Column(name = "category", nullable = false, length = 40)
    private NotificationCategory category;

    @Enumerated(EnumType.STRING)
    @Column(name = "priority", nullable = false, length = 10)
    private NotificationPriority priority;

    @Column(name = "title", nullable = false, length = 200)
    private String title;

    @Column(name = "message", nullable = false, length = 2000)
    private String message;

    @Column(name = "reference_type", length = 50)
    private String referenceType;

    @Column(name = "reference_id")
    private UUID referenceId;

    /** Prevents duplicates when the same business event is delivered twice. */
    @Column(name = "dedupe_key", length = 200)
    private String dedupeKey;

    @Enumerated(EnumType.STRING)
    @Column(name = "email_status", nullable = false, length = 20)
    private EmailStatus emailStatus;

    @Column(name = "email_attempts", nullable = false)
    private int emailAttempts;

    @Column(name = "last_email_error", length = 500)
    private String lastEmailError;

    @Column(name = "created_by")
    private UUID createdBy;

    @Builder
    private Notification(UUID recipientUserId, String recipientRole, NotificationCategory category,
                         NotificationPriority priority, String title, String message, String referenceType,
                         UUID referenceId, String dedupeKey, boolean sendEmail, UUID createdBy) {
        this.recipientUserId = recipientUserId;
        this.recipientRole = recipientRole;
        this.category = category;
        this.priority = priority == null ? NotificationPriority.NORMAL : priority;
        this.title = title;
        this.message = message;
        this.referenceType = referenceType;
        this.referenceId = referenceId;
        this.dedupeKey = dedupeKey;
        this.createdBy = createdBy;
        // Email is only sent to an individual user (role notifications are in-app only).
        this.emailStatus = sendEmail && recipientUserId != null ? EmailStatus.PENDING : EmailStatus.NOT_REQUESTED;
    }

    public boolean isVisibleTo(UUID userId, String role) {
        return (recipientUserId != null && recipientUserId.equals(userId))
                || (recipientRole != null && recipientRole.equals(role));
    }

    public void emailSent() {
        this.emailAttempts++;
        this.emailStatus = EmailStatus.SENT;
        this.lastEmailError = null;
    }

    public void emailFailed(String error, int maxAttempts) {
        this.emailAttempts++;
        this.lastEmailError = error == null ? null : error.substring(0, Math.min(500, error.length()));
        this.emailStatus = emailAttempts >= maxAttempts ? EmailStatus.FAILED : EmailStatus.PENDING;
    }
}
