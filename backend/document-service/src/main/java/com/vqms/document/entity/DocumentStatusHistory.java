package com.vqms.document.entity;

import com.vqms.document.entity.base.BaseEntity;
import com.vqms.document.enums.DocumentStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * Append-only audit row written on every status change of a {@link Document}.
 * {@code documentId} is a plain UUID column (same service, but keeps the history
 * independent of document loading and avoids lazy-loading surprises).
 */
@Entity
@Table(name = "document_status_history")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DocumentStatusHistory extends BaseEntity {

    @Column(name = "document_id", nullable = false, updatable = false)
    private UUID documentId;

    /** Null for the first entry (document creation). */
    @Enumerated(EnumType.STRING)
    @Column(name = "from_status", length = 30, updatable = false)
    private DocumentStatus fromStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "to_status", nullable = false, length = 30, updatable = false)
    private DocumentStatus toStatus;

    /** Null when the change was made by the system (e.g. cleanup job). */
    @Column(name = "changed_by", updatable = false)
    private UUID changedBy;

    @Column(name = "reason", length = 1000, updatable = false)
    private String reason;

    public DocumentStatusHistory(UUID documentId,
                                 DocumentStatus fromStatus,
                                 DocumentStatus toStatus,
                                 UUID changedBy,
                                 String reason) {
        this.documentId = documentId;
        this.fromStatus = fromStatus;
        this.toStatus = toStatus;
        this.changedBy = changedBy;
        this.reason = reason;
    }
}
