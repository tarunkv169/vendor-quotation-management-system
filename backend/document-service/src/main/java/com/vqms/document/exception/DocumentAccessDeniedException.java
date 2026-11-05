package com.vqms.document.exception;

/**
 * Thrown when the authenticated user is not allowed to access or modify a document.
 * Mapped to HTTP 403.
 */
public class DocumentAccessDeniedException extends RuntimeException {

    public DocumentAccessDeniedException(String message) {
        super(message);
    }
}
