package com.vqms.recommendation.constants;

import java.math.BigDecimal;

public final class RecommendationConstants {

    public static final String API_BASE_PATH = "/api/v1/recommendations";
    public static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    public static final String AGGREGATE_TYPE = "RECOMMENDATION";
    public static final String EVENT_GENERATED = "RECOMMENDATION_GENERATED";
    public static final String EVENT_REGENERATED = "RECOMMENDATION_REGENERATED";
    public static final String EVENT_SUBMITTED_FOR_APPROVAL = "RECOMMENDATION_SUBMITTED_FOR_APPROVAL";

    private RecommendationConstants() {
    }
}
