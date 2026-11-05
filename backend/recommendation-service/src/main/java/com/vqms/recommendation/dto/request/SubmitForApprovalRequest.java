package com.vqms.recommendation.dto.request;

import jakarta.validation.constraints.Size;

/**
 * Body of POST /api/v1/recommendations/{id}/submit-for-approval.
 *
 * @param reviewAcknowledged must be true (with a comment) when the recommendation has open review points
 */
public record SubmitForApprovalRequest(@Size(max = 1000) String comment, boolean reviewAcknowledged) {
}
