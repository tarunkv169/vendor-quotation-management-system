package com.vqms.audit.exception;

/** Invalid audit submission (e.g. payload too large). HTTP 400. */
public class InvalidAuditEventException extends RuntimeException {

    public InvalidAuditEventException(String message) {
        super(message);
    }
}
