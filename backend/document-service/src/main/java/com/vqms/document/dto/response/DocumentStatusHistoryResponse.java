package com.vqms.document.dto.response;

import com.vqms.document.enums.DocumentStatus;

import java.time.Instant;
import java.util.UUID;

/** One entry of a document's status history. */
public record DocumentStatusHistoryResponse(
        UUID id,
        DocumentStatus fromStatus,
        DocumentStatus toStatus,
        UUID changedBy,
        String reason,
        Instant changedAt
) {
}
