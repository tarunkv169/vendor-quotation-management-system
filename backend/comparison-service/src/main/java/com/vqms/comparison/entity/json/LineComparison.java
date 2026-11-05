package com.vqms.comparison.entity.json;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Item-wise comparison of one requested procurement item across the comparable quotations
 * (stored as JSON in the comparison report).
 *
 * @param lowestQuotationId quotation with the lowest unit price among lines with a comparable unit
 */
public record LineComparison(
        UUID procurementItemId,
        String description,
        String requestedUnit,
        BigDecimal requestedQuantity,
        List<LineQuote> quotes,
        UUID lowestQuotationId,
        BigDecimal lowestUnitPrice
) {

    /** @param comparable false when the unit differs from the requested unit */
    public record LineQuote(UUID quotationId, UUID vendorId, String unit, BigDecimal quantity, BigDecimal unitPrice,
                            BigDecimal taxRate, BigDecimal discountRate, BigDecimal lineTotal, boolean comparable) {
    }
}
