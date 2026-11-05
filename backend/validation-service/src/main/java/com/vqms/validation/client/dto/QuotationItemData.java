package com.vqms.validation.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.math.BigDecimal;
import java.util.UUID;

/** Quotation line as persisted (and calculated) by the Quotation Service. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record QuotationItemData(
        UUID id,
        UUID procurementItemId,
        String itemName,
        String description,
        String unit,
        BigDecimal quantity,
        BigDecimal unitPrice,
        BigDecimal taxRate,
        BigDecimal discountRate,
        BigDecimal discountAmount,
        BigDecimal taxAmount,
        BigDecimal lineTotal,
        Integer deliveryDays,
        Integer warrantyMonths
) {
}
