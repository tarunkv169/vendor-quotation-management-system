package com.vqms.document.repository;

import com.vqms.document.entity.Document;
import com.vqms.document.enums.DocumentStatus;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Persistence for {@link Document}.
 * {@link JpaSpecificationExecutor} enables the dynamic filters used by the search endpoint
 * (see {@link DocumentSpecifications}).
 */
public interface DocumentRepository extends JpaRepository<Document, UUID>, JpaSpecificationExecutor<Document> {

    Optional<Document> findByIdAndDocumentStatusNot(UUID id, DocumentStatus status);

    /** Duplicate check for documents attached to a quotation. */
    boolean existsByQuotationIdAndChecksumAndDocumentStatusNotIn(
            UUID quotationId, String checksum, Collection<DocumentStatus> ignoredStatuses);

    /** Duplicate check for vendor-scoped documents (no quotation). */
    boolean existsByVendorIdAndQuotationIdIsNullAndChecksumAndDocumentStatusNotIn(
            UUID vendorId, String checksum, Collection<DocumentStatus> ignoredStatuses);

    /** Duplicate check for procurement attachments (no quotation, no vendor). */
    boolean existsByProcurementRequestIdAndQuotationIdIsNullAndVendorIdIsNullAndChecksumAndDocumentStatusNotIn(
            UUID procurementRequestId, String checksum, Collection<DocumentStatus> ignoredStatuses);

    /** Used by the cleanup job to find uploads that never completed. */
    List<Document> findByDocumentStatusAndCreatedAtBefore(DocumentStatus status, Instant before, Limit limit);
}
