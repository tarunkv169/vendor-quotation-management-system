package com.vqms.validation.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Set;

/**
 * Configurable validation policy ({@code vqms.validation.*}).
 *
 * <p>Rounding policy: amounts are recalculated at {@code calculationScale} (4) with HALF_UP,
 * exactly like the Quotation Service. Expected and quoted amounts are compared after rounding
 * both to the currency's minor units; differences above {@code amountTolerance} are reported.</p>
 *
 * @param allowedTaxRates        GST slabs accepted (percent)
 * @param allowedCurrencies      ISO-4217 codes accepted; empty = any valid ISO code
 * @param openProcurementStatuses procurement request statuses that accept quotations
 * @param activeQuotationStatuses statuses that count as an existing submission (duplicate detection)
 */
@Validated
@ConfigurationProperties(prefix = "vqms.validation")
public record ValidationProperties(
        @Min(2) @Max(10) int calculationScale,
        @NotNull BigDecimal amountTolerance,
        @NotEmpty Set<BigDecimal> allowedTaxRates,
        Set<String> allowedCurrencies,
        @NotNull BigDecimal maxDiscountRate,
        @NotNull BigDecimal priceDeviationWarningPercent,
        @NotEmpty Set<String> openProcurementStatuses,
        @NotEmpty Set<String> activeQuotationStatuses
) {

    public static final RoundingMode ROUNDING_MODE = RoundingMode.HALF_UP;

    /** Tax-rate membership that ignores scale (18 == 18.00). */
    public boolean isAllowedTaxRate(BigDecimal rate) {
        return allowedTaxRates.stream().anyMatch(allowed -> allowed.compareTo(rate) == 0);
    }
}
