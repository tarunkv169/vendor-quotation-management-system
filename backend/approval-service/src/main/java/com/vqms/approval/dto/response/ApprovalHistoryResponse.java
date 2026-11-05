package com.vqms.approval.dto.response;

import com.vqms.approval.enums.ApprovalAction;

import java.time.Instant;
import java.util.UUID;

public record ApprovalHistoryResponse(UUID id, UUID stepId, ApprovalAction action, UUID actorId, UUID onBehalfOf,
                                      String comment, Instant occurredAt) {
}
