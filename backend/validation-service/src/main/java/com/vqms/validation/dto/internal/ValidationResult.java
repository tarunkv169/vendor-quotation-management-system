package com.vqms.validation.dto.internal;

import java.math.BigDecimal;
import java.util.List;

/**
 * Output of the validation engine.
 * Expected amounts are recalculated independently and are reported, never written back.
 */
public record ValidationResult(
        List<IssueDraft> issues,
        BigDecimal expectedSubtotal,
        BigDecimal expectedDiscount,
        BigDecimal expectedTax,
        BigDecimal expectedTotal
) {
}
