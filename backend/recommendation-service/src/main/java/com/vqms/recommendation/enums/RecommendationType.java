package com.vqms.recommendation.enums;

/**
 * BEST_VALUE             - highest policy score among eligible, acceptable-risk quotations.
 * SINGLE_ELIGIBLE_VENDOR - only one eligible quotation (no competition; always reviewed).
 * NO_QUALIFYING_VENDOR   - no quotation meets the policy; a human must decide (no vendor is recommended).
 */
public enum RecommendationType {
    BEST_VALUE,
    SINGLE_ELIGIBLE_VENDOR,
    NO_QUALIFYING_VENDOR
}
