package com.vqms.comparison.exception;

import java.util.UUID;

/** HTTP 404. */
public class ComparisonNotFoundException extends RuntimeException {

    public ComparisonNotFoundException(UUID id) {
        super("Comparison not found: " + id);
    }
}
