package com.vqms.validation.enums;

/**
 * ERROR   - the quotation cannot be compared (FAILED).
 * WARNING - a human must confirm (NEEDS_REVIEW).
 * INFO    - informational only, does not change the status.
 */
public enum ValidationSeverity {
    ERROR,
    WARNING,
    INFO
}
