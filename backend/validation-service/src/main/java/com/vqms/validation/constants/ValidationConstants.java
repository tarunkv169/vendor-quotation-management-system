package com.vqms.validation.constants;

/** Shared constants of the Validation Service. */
public final class ValidationConstants {

    public static final String API_BASE_PATH = "/api/v1/validations";

    public static final String AGGREGATE_TYPE = "VALIDATION";
    public static final String EVENT_VALIDATION_COMPLETED = "VALIDATION_COMPLETED";
    public static final String EVENT_VALIDATION_FAILED = "VALIDATION_FAILED";
    public static final String EVENT_VALIDATION_NEEDS_REVIEW = "VALIDATION_NEEDS_REVIEW";

    public static final String EXTRACTION_CONSUMER = "validation.extraction-completed";

    private ValidationConstants() {
    }
}
