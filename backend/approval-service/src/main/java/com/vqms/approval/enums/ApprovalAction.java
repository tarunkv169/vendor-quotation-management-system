package com.vqms.approval.enums;

/** Audit-trail actions recorded in approval_history. */
public enum ApprovalAction {
    CREATED,
    STEP_ACTIVATED,
    APPROVED,
    REJECTED,
    ESCALATED,
    CANCELLED,
    COMPLETED
}
