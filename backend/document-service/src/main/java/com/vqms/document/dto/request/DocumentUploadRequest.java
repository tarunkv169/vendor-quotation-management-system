package com.vqms.document.dto.request;

import com.vqms.document.enums.DocumentType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

/**
 * Metadata sent with the multipart file upload (form fields next to the "file" part).
 *
 * <p>Ownership is never taken from here: the uploader comes from the JWT, and for
 * quotation documents vendorId/procurementRequestId are read from the Quotation Service.
 * {@code vendorId} is only honoured for administrators uploading vendor-scoped documents.</p>
 */
public record DocumentUploadRequest(

        @NotNull(message = "documentType is required")
        DocumentType documentType,

        @Schema(description = "Required for QUOTATION_PDF and QUOTATION_EXCEL")
        UUID quotationId,

        @Schema(description = "Admins only: target vendor for vendor-scoped documents")
        UUID vendorId,

        @Schema(description = "Required for PROCUREMENT_ATTACHMENT")
        UUID procurementRequestId,

        @Size(max = 500, message = "description must not exceed 500 characters")
        String description
) {
}
