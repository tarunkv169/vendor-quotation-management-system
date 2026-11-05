package com.vqms.reporting.enums;

/**
 * PROCUREMENT_SUMMARY - lifecycle of one procurement request: quotations, validation, comparison,
 *                       recommendation, approval.
 * APPROVAL_SPEND      - approved spend in a period, per vendor and currency.
 * VALIDATION_QUALITY  - validation outcomes in a period (pass rate, issues per run).
 */
public enum ReportType {
    PROCUREMENT_SUMMARY,
    APPROVAL_SPEND,
    VALIDATION_QUALITY
}
