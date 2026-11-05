package com.vqms.approval.dto.internal;

import com.vqms.approval.entity.ApprovalStep;

import java.util.UUID;

/**
 * Who may act on which step: the resolved step, the acting user and (for delegations) the
 * user on whose behalf the decision is taken.
 */
public record ApprovalWorkflowResult(ApprovalStep step, UUID actorId, UUID onBehalfOf, String authority) {
}
