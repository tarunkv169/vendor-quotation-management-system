package com.vqms.recommendation.exception;

import java.util.UUID;

/** The comparison contains no eligible quotation at all. HTTP 422. */
public class NoEligibleVendorException extends RuntimeException {

    public NoEligibleVendorException(UUID comparisonId) {
        super("Comparison " + comparisonId + " has no eligible quotation to recommend");
    }
}
