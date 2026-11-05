package com.vqms.notification.dto.response;

import com.vqms.notification.enums.EmailStatus;
import com.vqms.notification.enums.NotificationCategory;
import com.vqms.notification.enums.NotificationPriority;

import java.time.Instant;
import java.util.UUID;

public record NotificationResponse(
        UUID id,
        UUID recipientUserId,
        String recipientRole,
        NotificationCategory category,
        NotificationPriority priority,
        String title,
        String message,
        String referenceType,
        UUID referenceId,
        boolean read,
        EmailStatus emailStatus,
        Instant createdAt
) {
}
