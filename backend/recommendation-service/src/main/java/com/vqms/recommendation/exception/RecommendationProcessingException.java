package com.vqms.recommendation.exception;

/** Unexpected failure while generating or storing a recommendation. HTTP 500. */
public class RecommendationProcessingException extends RuntimeException {

    public RecommendationProcessingException(String message, Throwable cause) {
        super(message, cause);
    }
}
