package com.vqms.document.exception;

/**
 * Thrown when the same file (same SHA-256) is already attached to the same
 * quotation, vendor or procurement request. Mapped to HTTP 409.
 */
public class DuplicateDocumentException extends RuntimeException {

    public DuplicateDocumentException(String message) {
        super(message);
    }
}
