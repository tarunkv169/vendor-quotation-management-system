package com.vqms.document.security;

import com.vqms.document.entity.Document;
import com.vqms.document.enums.DocumentStatus;
import com.vqms.document.enums.DocumentType;
import com.vqms.document.exception.DocumentAccessDeniedException;
import org.springframework.stereotype.Component;

import java.util.EnumSet;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * Central authorization rules for documents (kept in one place so they are easy to audit).
 *
 * <pre>
 * Action          VENDOR            REVIEWER   ADMIN   INTERNAL_SERVICE
 * upload          own vendor        -          yes     -
 * read/download   own vendor        yes        yes     yes
 * delete          own vendor*       -          yes     -
 * change status   -                 -          yes     processing states only
 * (* only while the quotation is still DRAFT - checked in the service)
 * </pre>
 */
@Component
public class DocumentAccessPolicy {

    private static final Set<DocumentType> VENDOR_UPLOAD_TYPES = EnumSet.of(
            DocumentType.QUOTATION_PDF,
            DocumentType.QUOTATION_EXCEL,
            DocumentType.VENDOR_CERTIFICATE,
            DocumentType.SUPPORTING_DOCUMENT);

    private static final Set<DocumentStatus> INTERNAL_SERVICE_STATUSES = EnumSet.of(
            DocumentStatus.PROCESSING,
            DocumentStatus.PROCESSED,
            DocumentStatus.FAILED);

    public void assertCanUpload(AuthenticatedUser user, DocumentType type) {
        if (user.isAdministrator()) {
            return;
        }
        if (user.isVendor() && VENDOR_UPLOAD_TYPES.contains(type)) {
            return;
        }
        throw new DocumentAccessDeniedException("You are not allowed to upload documents of type " + type);
    }

    public void assertCanRead(AuthenticatedUser user, Document document) {
        if (user.hasGlobalReadAccess()) {
            return;
        }
        if (user.isVendor() && isOwnVendorDocument(user, document)) {
            return;
        }
        throw new DocumentAccessDeniedException("You are not allowed to access this document");
    }

    public void assertCanDelete(AuthenticatedUser user, Document document) {
        if (user.isAdministrator()) {
            return;
        }
        if (user.isVendor() && isOwnVendorDocument(user, document)) {
            return;
        }
        throw new DocumentAccessDeniedException("You are not allowed to delete this document");
    }

    public void assertCanChangeStatus(AuthenticatedUser user, DocumentStatus target) {
        if (user.isAdministrator()) {
            return;
        }
        if (user.isInternalService() && INTERNAL_SERVICE_STATUSES.contains(target)) {
            return;
        }
        throw new DocumentAccessDeniedException("You are not allowed to set document status " + target);
    }

    /** Vendors may only query their own vendor id. */
    public void assertCanQueryVendor(AuthenticatedUser user, UUID vendorId) {
        if (user.isVendor() && vendorId != null && !vendorId.equals(user.vendorId())) {
            throw new DocumentAccessDeniedException("Vendors can only access their own documents");
        }
    }

    public void assertCanViewDeleted(AuthenticatedUser user) {
        if (!user.isAdministrator()) {
            throw new DocumentAccessDeniedException("Only administrators can list deleted documents");
        }
    }

    private boolean isOwnVendorDocument(AuthenticatedUser user, Document document) {
        return document.getVendorId() != null && Objects.equals(document.getVendorId(), user.vendorId());
    }
}
