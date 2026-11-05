package com.vqms.recommendation.exception;

/** Invalid request or operation not allowed in the current state. HTTP 400. */
public class InvalidRecommendationException extends RuntimeException {

    public InvalidRecommendationException(String message) {
        super(message);
    }
}
