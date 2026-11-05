package com.vqms.notification.exception;

import java.util.UUID;

/** Also used when the notification exists but is not visible to the caller (no information leak). HTTP 404. */
public class NotificationNotFoundException extends RuntimeException {

    public NotificationNotFoundException(UUID id) {
        super("Notification not found: " + id);
    }
}
