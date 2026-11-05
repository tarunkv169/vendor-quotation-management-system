package com.vqms.approval.dto.request;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.UUID;

/** Delegate the caller's approval authority to another user for a period. The delegator is the caller. */
public record ApprovalDelegationRequest(
        @NotNull UUID delegateId,
        Instant validFrom,
        @NotNull @Future Instant validUntil,
        @NotBlank @Size(max = 500) String reason
) {
}
