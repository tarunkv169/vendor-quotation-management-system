package com.vqms.comparison.dto.request;

import com.vqms.comparison.enums.ComparisonCriteria;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.UUID;

/** Evaluator score (0-100) with a mandatory justification. */
public record ManualScoreRequest(
        @NotNull UUID quotationId,
        @NotNull ComparisonCriteria criterion,
        @NotNull @DecimalMin("0") @DecimalMax("100") BigDecimal score,
        @NotBlank @Size(max = 500) String justification
) {
}
