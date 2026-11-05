package com.vqms.validation.exception;

import java.util.UUID;

/** Mapped to HTTP 404. */
public class ValidationNotFoundException extends RuntimeException {

    public ValidationNotFoundException(UUID id) {
        super("Validation not found: " + id);
    }
}
