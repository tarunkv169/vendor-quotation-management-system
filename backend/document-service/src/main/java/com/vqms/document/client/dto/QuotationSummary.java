package com.vqms.document.client.dto;

import java.util.UUID;

/**
 * The subset of Quotation Service's QuotationResponse that this service needs.
 * Unknown JSON fields are ignored (Spring Boot's default ObjectMapper setting).
 */
public record QuotationSummary(
        UUID id,
        String quotationNumber,
        UUID procurementRequestId,
        UUID vendorId,
        String status
) {

    /** Vendors may add or remove documents only while the quotation is still a draft. */
    public boolean isEditableByVendor() {
        return "DRAFT".equalsIgnoreCase(status);
    }
}
