package com.vqms.document.entity;

import com.vqms.document.entity.base.BaseEntity;
import com.vqms.document.enums.DocumentStatus;
import com.vqms.document.enums.DocumentType;
import com.vqms.document.exception.InvalidDocumentStateException;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

/**
 * Metadata of a stored document. The file itself lives in S3 under {@link #storageKey}.
 *
 * <p>Other microservices are referenced by plain UUID columns (vendorId, quotationId,
 * procurementRequestId) - never by JPA relationships across service boundaries.</p>
 *
 * <p>State changes go through {@link #transitionTo(DocumentStatus)} so the allowed
 * lifecycle in {@link DocumentStatus} can never be bypassed.</p>
 */
@Entity
@Table(name = "documents")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED) // required by JPA, hidden from callers
public class Document extends BaseEntity {

    /** Sanitized original file name, used only for display and Content-Disposition. */
    @Column(name = "document_name", nullable = false, length = 255)
    private String documentName;

    /** Server-generated name ({uuid}.{ext}); never derived from user input. */
    @Column(name = "stored_file_name", nullable = false, length = 100)
    private String storedFileName;

    @Enumerated(EnumType.STRING)
    @Column(name = "document_type", nullable = false, length = 50)
    private DocumentType documentType;

    @Enumerated(EnumType.STRING)
    @Column(name = "document_status", nullable = false, length = 30)
    private DocumentStatus documentStatus;

    /** Authenticated user who uploaded the document (from the JWT, never from the request). */
    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    @Column(name = "vendor_id")
    private UUID vendorId;

    @Column(name = "quotation_id")
    private UUID quotationId;

    @Column(name = "procurement_request_id")
    private UUID procurementRequestId;

    @Column(name = "storage_key", nullable = false, length = 512, unique = true)
    private String storageKey;

    @Column(name = "bucket_name", nullable = false, length = 63)
    private String bucketName;

    /** Content type verified from the file's magic bytes. */
    @Column(name = "content_type", nullable = false, length = 150)
    private String contentType;

    @Column(name = "file_size", nullable = false)
    private long fileSize;

    /** Hex-encoded SHA-256 of the file content. */
    @Column(name = "checksum", nullable = false, length = 64)
    private String checksum;

    @Column(name = "description", length = 500)
    private String description;

    @Column(name = "failure_reason", length = 1000)
    private String failureReason;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @Column(name = "deleted_by")
    private UUID deletedBy;

    /**
     * {@code @Builder} generates a fluent builder for this constructor.
     * New documents always start in {@link DocumentStatus#UPLOADING}.
     */
    @Builder
    private Document(String documentName,
                     String storedFileName,
                     DocumentType documentType,
                     UUID ownerId,
                     UUID vendorId,
                     UUID quotationId,
                     UUID procurementRequestId,
                     String storageKey,
                     String bucketName,
                     String contentType,
                     long fileSize,
                     String checksum,
                     String description) {
        this.documentName = documentName;
        this.storedFileName = storedFileName;
        this.documentType = documentType;
        this.documentStatus = DocumentStatus.UPLOADING;
        this.ownerId = ownerId;
        this.vendorId = vendorId;
        this.quotationId = quotationId;
        this.procurementRequestId = procurementRequestId;
        this.storageKey = storageKey;
        this.bucketName = bucketName;
        this.contentType = contentType;
        this.fileSize = fileSize;
        this.checksum = checksum;
        this.description = description;
    }

    /**
     * Moves the document to a new status, enforcing the allowed lifecycle.
     *
     * @throws InvalidDocumentStateException when the transition is not allowed
     */
    public void transitionTo(DocumentStatus target) {
        if (!documentStatus.canTransitionTo(target)) {
            throw new InvalidDocumentStateException(
                    "Document cannot move from " + documentStatus + " to " + target);
        }
        this.documentStatus = target;
        if (target == DocumentStatus.ACTIVE || target == DocumentStatus.PROCESSING
                || target == DocumentStatus.PROCESSED) {
            this.failureReason = null;
        }
    }

    public void markFailed(DocumentStatus failureStatus, String reason) {
        transitionTo(failureStatus);
        this.failureReason = reason;
    }

    public void markDeleted(UUID deletedByUserId, Instant at) {
        transitionTo(DocumentStatus.DELETED);
        this.deletedBy = deletedByUserId;
        this.deletedAt = at;
    }
}
