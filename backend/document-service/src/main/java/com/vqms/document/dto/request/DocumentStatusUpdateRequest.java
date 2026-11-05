package com.vqms.document.dto.request;

import com.vqms.document.enums.DocumentStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Body of PATCH /api/v1/documents/{id}/status.
 * Only ACTIVE, PROCESSING, PROCESSED, FAILED and QUARANTINED can be set manually.
 */
public record DocumentStatusUpdateRequest(

        @NotNull(message = "status is required")
        DocumentStatus status,

        @Size(max = 1000, message = "reason must not exceed 1000 characters")
        String reason
) {
}
