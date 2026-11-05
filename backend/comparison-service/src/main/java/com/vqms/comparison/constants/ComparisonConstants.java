package com.vqms.comparison.constants;

import java.math.BigDecimal;

/** Shared constants of the Comparison Service. */
public final class ComparisonConstants {

    public static final String API_BASE_PATH = "/api/v1/comparisons";
    public static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    public static final String AGGREGATE_TYPE = "COMPARISON";
    public static final String EVENT_COMPARISON_COMPLETED = "COMPARISON_COMPLETED";
    public static final String EVENT_COMPARISON_FAILED = "COMPARISON_FAILED";

    private ComparisonConstants() {
    }
}
