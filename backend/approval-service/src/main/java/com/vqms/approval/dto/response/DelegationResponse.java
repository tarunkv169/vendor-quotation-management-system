package com.vqms.approval.dto.response;

import java.time.Instant;
import java.util.UUID;

public record DelegationResponse(UUID id, UUID delegatorId, String delegatorRole, UUID delegateId, Instant validFrom,
                                 Instant validUntil, String reason, boolean active, boolean effectiveNow) {
}
