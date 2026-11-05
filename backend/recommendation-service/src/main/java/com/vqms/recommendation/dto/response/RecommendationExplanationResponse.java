package com.vqms.recommendation.dto.response;

import java.util.List;
import java.util.UUID;

/** Human-readable, deterministic explanation of the recommendation and of every quotation's outcome. */
public record RecommendationExplanationResponse(
        UUID recommendationId,
        String summary,
        List<String> reviewReasons,
        List<ItemExplanation> items
) {

    public record ItemExplanation(UUID quotationId, Integer rank, String explanation) {
    }
}
