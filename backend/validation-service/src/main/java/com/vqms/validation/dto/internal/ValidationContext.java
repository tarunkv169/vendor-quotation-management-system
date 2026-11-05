package com.vqms.validation.dto.internal;

import com.vqms.validation.client.dto.ProcurementRequestData;
import com.vqms.validation.client.dto.QuotationData;
import com.vqms.validation.client.dto.QuotationSummaryData;
import com.vqms.validation.client.dto.VendorData;
import com.vqms.validation.dto.request.ExtractionPayload;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * Everything a validation run needs, loaded from the authoritative services before any rule runs.
 * Optional values are empty when the referenced record does not exist (reported as ERROR issues).
 */
public record ValidationContext(
        QuotationData quotation,
        Optional<VendorData> vendor,
        Optional<ProcurementRequestData> procurementRequest,
        List<QuotationSummaryData> otherQuotationsForRequest,
        Optional<ExtractionPayload> extraction,
        LocalDate today
) {
}
