package com.vqms.validation.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Authoritative quotation from the Quotation Service (subset of QuotationResponse). */
@JsonIgnoreProperties(ignoreUnknown = true)
public record QuotationData(
        UUID id,
        String quotationNumber,
        UUID procurementRequestId,
        UUID vendorId,
        String status,
        String currencyCode,
        LocalDate issueDate,
        LocalDate validUntil,
        BigDecimal subtotal,
        BigDecimal taxAmount,
        BigDecimal discountAmount,
        BigDecimal totalAmount,
        List<QuotationItemData> items,
        Long version
) {

    public List<QuotationItemData> safeItems() {
        return items == null ? List.of() : items;
    }
}
