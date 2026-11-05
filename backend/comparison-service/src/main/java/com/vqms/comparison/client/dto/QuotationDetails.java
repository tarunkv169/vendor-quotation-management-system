package com.vqms.comparison.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Authoritative quotation (financial values calculated by the Quotation Service). */
@JsonIgnoreProperties(ignoreUnknown = true)
public record QuotationDetails(
        UUID id,
        String quotationNumber,
        UUID procurementRequestId,
        UUID vendorId,
        String status,
        String currencyCode,
        LocalDate validUntil,
        BigDecimal subtotal,
        BigDecimal taxAmount,
        BigDecimal discountAmount,
        BigDecimal totalAmount,
        List<Item> items,
        Long version
) {

    public List<Item> safeItems() {
        return items == null ? List.of() : items;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Item(UUID id, UUID procurementItemId, String itemName, String unit, BigDecimal quantity,
                       BigDecimal unitPrice, BigDecimal taxRate, BigDecimal discountRate, BigDecimal lineTotal,
                       Integer deliveryDays, Integer warrantyMonths) {
    }
}
