package com.vqms.notification.exception;

/** HTTP 400. */
public class InvalidNotificationException extends RuntimeException {

    public InvalidNotificationException(String message) {
        super(message);
    }
}
