package com.vqms.document.exception;

/**
 * Thrown when the file storage (S3) operation fails. Mapped to HTTP 503.
 * The message is generic; the cause is logged, never returned to clients.
 */
public class DocumentStorageException extends RuntimeException {

    public DocumentStorageException(String message, Throwable cause) {
        super(message, cause);
    }
}
