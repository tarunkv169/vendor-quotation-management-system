package com.vqms.approval.enums;

/**
 * PENDING     - created, no decision yet.
 * IN_PROGRESS - at least one level approved, further levels open.
 * APPROVED    - all levels approved (final).
 * REJECTED    - rejected at any level, with a mandatory comment (final).
 * CANCELLED   - withdrawn by an administrator (final).
 */
public enum ApprovalStatus {
    PENDING,
    IN_PROGRESS,
    APPROVED,
    REJECTED,
    CANCELLED;

    public boolean isOpen() {
        return this == PENDING || this == IN_PROGRESS;
    }
}
