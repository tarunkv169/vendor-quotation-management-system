package com.vqms.approval.dto.request;

import jakarta.validation.constraints.Size;

/** Approve / reject / cancel / escalate body. The comment is mandatory for rejection and cancellation. */
public record ApprovalDecisionRequest(@Size(max = 1000) String comment) {
}
