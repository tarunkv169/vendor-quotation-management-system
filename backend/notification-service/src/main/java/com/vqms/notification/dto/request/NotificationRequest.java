package com.vqms.notification.dto.request;

import com.vqms.notification.enums.NotificationCategory;
import com.vqms.notification.enums.NotificationPriority;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

/**
 * Body of POST /api/v1/notifications. Exactly one of {@code recipientUserId} / {@code recipientRole}.
 *
 * @param dedupeKey optional key; a second request with the same key returns the existing notification
 * @param sendEmail also e-mail the user (only for user-targeted notifications and when email is enabled)
 */
public record NotificationRequest(
        UUID recipientUserId,
        @Size(max = 40) String recipientRole,
        @NotNull NotificationCategory category,
        NotificationPriority priority,
        @NotBlank @Size(max = 200) String title,
        @NotBlank @Size(max = 2000) String message,
        @Size(max = 50) String referenceType,
        UUID referenceId,
        @Size(max = 200) String dedupeKey,
        boolean sendEmail
) {
}
