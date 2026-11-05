package com.vqms.comparison.exception;

/** Unexpected failure while calculating or storing a comparison. HTTP 500. */
public class ComparisonProcessingException extends RuntimeException {

    public ComparisonProcessingException(String message, Throwable cause) {
        super(message, cause);
    }
}
