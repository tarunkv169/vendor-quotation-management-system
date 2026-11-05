package com.vqms.approval.enums;

/** WAITING (not yet open, sequential only) -> PENDING -> APPROVED | REJECTED; CANCELLED when the approval ends. */
public enum ApprovalStepStatus {
    WAITING,
    PENDING,
    APPROVED,
    REJECTED,
    CANCELLED
}
