package com.vqms.comparison.dto.request;

import com.vqms.comparison.enums.ComparisonCriteria;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

/**
 * Weight (percent) of one criterion. All weights of a comparison must total exactly 100.
 *
 * @param minimumScore optional eligibility threshold (0-100) for this criterion
 */
public record ComparisonCriteriaRequest(
        @NotNull ComparisonCriteria criterion,
        @NotNull @DecimalMin("0") @DecimalMax("100") @Digits(integer = 3, fraction = 2) BigDecimal weight,
        @DecimalMin("0") @DecimalMax("100") BigDecimal minimumScore
) {
}
