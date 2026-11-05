package com.vqms.document.event;

import com.vqms.document.constants.DocumentConstants;
import com.vqms.document.entity.Document;
import com.vqms.document.enums.DocumentType;

import java.time.Instant;
import java.util.UUID;

/**
 * In-process Spring application event published after a document is stored successfully.
 *
 * <p>The event carries no file content and no S3 location: consumers fetch the file through
 * GET /api/v1/documents/{id}/download using their own service credentials and verify
 * the {@code checksum}. {@code eventId} lets consumers deduplicate redelivered messages.</p>
 */
public record DocumentUploadedEvent(
        UUID eventId,
        String eventType,
        Instant occurredAt,
        String correlationId,
        UUID documentId,
        DocumentType documentType,
        boolean extractable,
        String contentType,
        long fileSize,
        String checksum,
        UUID quotationId,
        UUID vendorId,
        UUID procurementRequestId,
        UUID uploadedBy
) {

    public static DocumentUploadedEvent from(Document document, String correlationId) {
        return new DocumentUploadedEvent(
                UUID.randomUUID(),
                DocumentConstants.EVENT_TYPE_DOCUMENT_UPLOADED,
                Instant.now(),
                correlationId,
                document.getId(),
                document.getDocumentType(),
                document.getDocumentType().isExtractable(),
                document.getContentType(),
                document.getFileSize(),
                document.getChecksum(),
                document.getQuotationId(),
                document.getVendorId(),
                document.getProcurementRequestId(),
                document.getOwnerId()
        );
    }
}
