package com.vqms.notification.enums;

/** NOT_REQUESTED (in-app only) | PENDING -> SENT, or FAILED after the maximum number of attempts. */
public enum EmailStatus {
    NOT_REQUESTED,
    PENDING,
    SENT,
    FAILED
}
