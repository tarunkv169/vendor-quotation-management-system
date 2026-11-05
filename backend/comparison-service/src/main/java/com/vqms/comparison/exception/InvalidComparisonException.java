package com.vqms.comparison.exception;

/** Invalid configuration (weights, criteria) or operation not allowed in the current state. HTTP 400. */
public class InvalidComparisonException extends RuntimeException {

    public InvalidComparisonException(String message) {
        super(message);
    }
}
