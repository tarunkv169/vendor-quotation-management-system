package com.vqms.comparison.enums;

/**
 * RANKED       - eligible and scored.
 * INELIGIBLE   - fails an eligibility condition (validation, mandatory requirement, expiry...).
 * INCOMPARABLE - cannot be compared (different currency, missing totals).
 */
public enum ComparisonResultType {
    RANKED,
    INELIGIBLE,
    INCOMPARABLE
}
