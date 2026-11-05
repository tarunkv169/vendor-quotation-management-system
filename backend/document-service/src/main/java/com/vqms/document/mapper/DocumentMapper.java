package com.vqms.document.mapper;

import com.vqms.document.dto.response.DocumentResponse;
import com.vqms.document.dto.response.DocumentStatusHistoryResponse;
import com.vqms.document.entity.Document;
import com.vqms.document.entity.DocumentStatusHistory;
import org.springframework.stereotype.Component;

/**
 * Converts entities to API responses. Hand-written (no MapStruct) because the mapping is
 * small and keeping it explicit guarantees internal fields are never leaked.
 */
@Component
public class DocumentMapper {

    public DocumentResponse toResponse(Document document) {
        return new DocumentResponse(
                document.getId(),
                document.getDocumentName(),
                document.getDocumentType(),
                document.getDocumentStatus(),
                document.getOwnerId(),
                document.getVendorId(),
                document.getQuotationId(),
                document.getProcurementRequestId(),
                document.getContentType(),
                document.getFileSize(),
                document.getChecksum(),
                document.getDescription(),
                document.getFailureReason(),
                document.getCreatedAt(),
                document.getUpdatedAt(),
                document.getVersion()
        );
    }

    public DocumentStatusHistoryResponse toHistoryResponse(DocumentStatusHistory history) {
        return new DocumentStatusHistoryResponse(
                history.getId(),
                history.getFromStatus(),
                history.getToStatus(),
                history.getChangedBy(),
                history.getReason(),
                history.getCreatedAt()
        );
    }
}
