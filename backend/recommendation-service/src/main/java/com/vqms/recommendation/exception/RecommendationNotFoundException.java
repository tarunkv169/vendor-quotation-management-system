package com.vqms.recommendation.exception;

import java.util.UUID;

/** HTTP 404. */
public class RecommendationNotFoundException extends RuntimeException {

    public RecommendationNotFoundException(UUID id) {
        super("Recommendation not found: " + id);
    }
}
