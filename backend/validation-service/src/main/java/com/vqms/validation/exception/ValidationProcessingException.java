package com.vqms.validation.exception;

/** Unexpected failure while running or persisting a validation. HTTP 500. */
public class ValidationProcessingException extends RuntimeException {

    public ValidationProcessingException(String message, Throwable cause) {
        super(message, cause);
    }
}
