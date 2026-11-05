package com.vqms.document.exception;

/**
 * Thrown when an operation is not allowed in the document's (or quotation's) current state,
 * e.g. downloading a quarantined file. Mapped to HTTP 409.
 */
public class InvalidDocumentStateException extends RuntimeException {

    public InvalidDocumentStateException(String message) {
        super(message);
    }
}
