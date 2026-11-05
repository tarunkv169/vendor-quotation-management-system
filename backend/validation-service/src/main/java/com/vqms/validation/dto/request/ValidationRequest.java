package com.vqms.validation.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

/**
 * Body of POST /api/v1/validations. Only references are accepted; vendor, procurement request
 * and financial values are always loaded from their owning services.
 *
 * @param extraction optional AI extraction to cross-check against the quotation (DOCUMENT_VALIDATION)
 */
public record ValidationRequest(
        @NotNull(message = "quotationId is required") UUID quotationId,
        UUID extractionId,
        UUID documentId,
        @Valid ExtractionPayload extraction
) {
}
