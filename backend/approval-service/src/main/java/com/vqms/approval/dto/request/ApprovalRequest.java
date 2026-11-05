package com.vqms.approval.dto.request;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

/**
 * Body of POST /api/v1/approvals: create an approval for a recommendation that was submitted
 * for approval. Amount, vendor and submitter are loaded from the Recommendation Service.
 */
public record ApprovalRequest(@NotNull UUID recommendationId) {
}
