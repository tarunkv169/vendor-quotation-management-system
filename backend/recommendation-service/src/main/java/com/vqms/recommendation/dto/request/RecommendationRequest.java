package com.vqms.recommendation.dto.request;

import com.vqms.recommendation.enums.RecommendationCriteria;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Body of POST /api/v1/recommendations.
 *
 * @param policyCode optional policy (default "DEFAULT")
 * @param criteria   optional procurement-specific weights (total 100); default = the comparison's weights
 */
public record RecommendationRequest(
        @NotNull UUID comparisonId,
        @Size(max = 40) String policyCode,
        @Size(max = 6) List<@Valid CriterionWeight> criteria
) {

    public record CriterionWeight(
            @NotNull RecommendationCriteria criterion,
            @NotNull @DecimalMin("0") @DecimalMax("100") BigDecimal weight
    ) {
    }
}
