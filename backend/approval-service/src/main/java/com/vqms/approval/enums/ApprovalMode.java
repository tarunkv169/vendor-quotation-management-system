package com.vqms.approval.enums;

/**
 * SEQUENTIAL - levels decide one after another (level 2 opens when level 1 approves).
 * PARALLEL   - all levels are open at once; the approval completes when every level approved.
 */
public enum ApprovalMode {
    SEQUENTIAL,
    PARALLEL
}
