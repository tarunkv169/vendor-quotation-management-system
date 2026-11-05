package com.vqms.comparison.enums;

/**
 * Scoring criteria. Data sources:
 * PRICE, DELIVERY_TIME, WARRANTY - authoritative quotation data;
 * TECHNICAL_COMPLIANCE - coverage of the requested items (or evaluator scores when given);
 * QUALITY, COMMERCIAL_TERMS - evaluator scores only (never invented).
 */
public enum ComparisonCriteria {
    PRICE,
    DELIVERY_TIME,
    WARRANTY,
    TECHNICAL_COMPLIANCE,
    QUALITY,
    COMMERCIAL_TERMS
}
