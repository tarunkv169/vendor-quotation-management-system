package com.vqms.document.dto.response;

import java.time.Instant;
import java.util.UUID;

/**
 * Short-lived presigned download link. The URL grants access to exactly one object
 * until {@code expiresAt}; it must not be logged or cached by clients.
 */
public record DocumentDownloadResponse(
        UUID documentId,
        String documentName,
        String contentType,
        long fileSize,
        String checksum,
        String downloadUrl,
        Instant expiresAt
) {
}
