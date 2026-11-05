package com.vqms.document.dto.response;

import com.vqms.document.enums.DocumentStatus;
import com.vqms.document.enums.DocumentType;

import java.time.Instant;
import java.util.UUID;

/**
 * Public view of a document. Storage internals (bucket, storage key, stored file name)
 * are intentionally not exposed.
 */
public record DocumentResponse(
        UUID id,
        String documentName,
        DocumentType documentType,
        DocumentStatus documentStatus,
        UUID ownerId,
        UUID vendorId,
        UUID quotationId,
        UUID procurementRequestId,
        String contentType,
        long fileSize,
        String checksum,
        String description,
        String failureReason,
        Instant createdAt,
        Instant updatedAt,
        Long version
) {
}
