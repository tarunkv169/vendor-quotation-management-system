package com.vqms.document.exception;

/**
 * Thrown when an uploaded file or request is invalid (type, size, content, references).
 * Mapped to HTTP 400.
 */
public class InvalidDocumentException extends RuntimeException {

    public InvalidDocumentException(String message) {
        super(message);
    }
}
