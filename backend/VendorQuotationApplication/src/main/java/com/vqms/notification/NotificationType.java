package com.vqms.notification;

/** Business events that notify someone, with the Notification Service category and priority. */
public enum NotificationType {
    REQUEST_SUBMITTED("REQUEST_SUBMITTED", "NORMAL"),
    REQUEST_APPROVED("REQUEST_APPROVED", "NORMAL"),
    REQUEST_REJECTED("REQUEST_REJECTED", "HIGH"),
    QUOTATIONS_REQUESTED("QUOTATIONS_REQUESTED", "NORMAL"),
    REQUEST_COMPLETED("REQUEST_COMPLETED", "LOW"),
    QUOTATION_RECEIVED("QUOTATION_RECEIVED", "NORMAL"),
    QUOTATION_REVIEWED("QUOTATION_UPDATE", "NORMAL");

    private final String category;
    private final String priority;

    NotificationType(String category, String priority) {
        this.category = category;
        this.priority = priority;
    }

    public String category() {
        return category;
    }

    public String priority() {
        return priority;
    }
}
