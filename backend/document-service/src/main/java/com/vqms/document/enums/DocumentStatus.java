package com.vqms.document.enums;

import java.util.EnumSet;
import java.util.Set;

/**
 * Lifecycle of a document with explicit allowed transitions.
 *
 * <pre>
 * UPLOADING ──► ACTIVE ──► PROCESSING ──► PROCESSED
 *     │           │            │
 *     ▼           ▼            ▼
 * UPLOAD_FAILED  QUARANTINED  FAILED (processing failed, may be retried)
 * </pre>
 * Every non-terminal state can move to DELETED (soft delete).
 */
public enum DocumentStatus {

    /** Metadata row saved, file upload to S3 in progress. */
    UPLOADING,
    /** Reserved for a future malware-scanning step. */
    PENDING_SCAN,
    /** Stored and available for download. */
    ACTIVE,
    /** Being processed by the AI Extraction Service. */
    PROCESSING,
    /** AI extraction finished. */
    PROCESSED,
    /** AI extraction failed; may be retried. */
    FAILED,
    /** File never reached storage; terminal except for deletion. */
    UPLOAD_FAILED,
    /** Blocked by an administrator (e.g. suspicious content). */
    QUARANTINED,
    /** Soft deleted; terminal. */
    DELETED;

    public Set<DocumentStatus> allowedTransitions() {
        return switch (this) {
            case UPLOADING -> EnumSet.of(ACTIVE, PENDING_SCAN, UPLOAD_FAILED, DELETED);
            case PENDING_SCAN -> EnumSet.of(ACTIVE, QUARANTINED, UPLOAD_FAILED, DELETED);
            case ACTIVE -> EnumSet.of(PROCESSING, QUARANTINED, DELETED);
            case PROCESSING -> EnumSet.of(PROCESSED, FAILED, QUARANTINED, DELETED);
            case PROCESSED -> EnumSet.of(PROCESSING, QUARANTINED, DELETED);
            case FAILED -> EnumSet.of(PROCESSING, QUARANTINED, DELETED);
            case QUARANTINED -> EnumSet.of(ACTIVE, DELETED);
            case UPLOAD_FAILED -> EnumSet.of(DELETED);
            case DELETED -> EnumSet.noneOf(DocumentStatus.class);
        };
    }

    public boolean canTransitionTo(DocumentStatus target) {
        return allowedTransitions().contains(target);
    }

    /** Only documents whose file is safely stored may be downloaded. */
    public boolean isDownloadable() {
        return this == ACTIVE || this == PROCESSING || this == PROCESSED || this == FAILED;
    }

    /** Statuses that may be set through PATCH /status. Others are managed internally. */
    public boolean isManuallyAssignable() {
        return this == ACTIVE || this == PROCESSING || this == PROCESSED
                || this == FAILED || this == QUARANTINED;
    }

    /** Statuses that do not count when detecting duplicate uploads. */
    public static Set<DocumentStatus> ignoredForDuplicateCheck() {
        return EnumSet.of(DELETED, UPLOAD_FAILED);
    }
}
