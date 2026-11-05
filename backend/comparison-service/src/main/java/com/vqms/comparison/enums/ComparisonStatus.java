package com.vqms.comparison.enums;

/**
 * CREATED -> CALCULATED -> COMPLETED. CALCULATED may be recalculated; COMPLETED is final.
 * FAILED: calculation was not possible (e.g. too few eligible quotations); can be recalculated.
 */
public enum ComparisonStatus {
    CREATED,
    CALCULATED,
    COMPLETED,
    FAILED;

    public boolean canCalculate() {
        return this != COMPLETED;
    }
}
