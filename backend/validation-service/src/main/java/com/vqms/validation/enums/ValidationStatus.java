package com.vqms.validation.enums;

/**
 * Outcome of a validation run.
 *
 * <p>Status rule (applied to the issues of one run):</p>
 * <ul>
 *   <li>any ERROR            -> FAILED</li>
 *   <li>else any WARNING     -> NEEDS_REVIEW</li>
 *   <li>else (INFO or none)  -> PASSED (eligible for comparison)</li>
 * </ul>
 * PENDING / IN_PROGRESS are reserved for asynchronous runs; synchronous runs are persisted
 * directly in their final status.
 */
public enum ValidationStatus {
    PENDING,
    IN_PROGRESS,
    PASSED,
    FAILED,
    NEEDS_REVIEW;

    public static ValidationStatus fromCounts(int errors, int warnings) {
        if (errors > 0) {
            return FAILED;
        }
        return warnings > 0 ? NEEDS_REVIEW : PASSED;
    }
}
