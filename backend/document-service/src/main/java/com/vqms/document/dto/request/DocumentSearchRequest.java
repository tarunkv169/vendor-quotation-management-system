package com.vqms.document.dto.request;

import com.vqms.document.enums.DocumentStatus;
import com.vqms.document.enums.DocumentType;

import java.util.UUID;

/**
 * Optional query-parameter filters for GET /api/v1/documents.
 * For vendor users the vendorId filter is always forced to their own vendor.
 */
public record DocumentSearchRequest(
        DocumentType documentType,
        DocumentStatus status,
        UUID quotationId,
        UUID vendorId,
        UUID procurementRequestId
) {

    public static DocumentSearchRequest byQuotation(UUID quotationId) {
        return new DocumentSearchRequest(null, null, quotationId, null, null);
    }

    public static DocumentSearchRequest byVendor(UUID vendorId) {
        return new DocumentSearchRequest(null, null, null, vendorId, null);
    }

    public static DocumentSearchRequest byProcurementRequest(UUID procurementRequestId) {
        return new DocumentSearchRequest(null, null, null, null, procurementRequestId);
    }

    public DocumentSearchRequest withVendorId(UUID newVendorId) {
        return new DocumentSearchRequest(documentType, status, quotationId, newVendorId, procurementRequestId);
    }
}
