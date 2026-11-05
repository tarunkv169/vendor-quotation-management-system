package com.vqms.document.exception;

import java.util.UUID;

/** Thrown when a document does not exist or has been deleted. Mapped to HTTP 404. */
public class DocumentNotFoundException extends RuntimeException {

    public DocumentNotFoundException(UUID documentId) {
        super("Document not found: " + documentId);
    }
}
