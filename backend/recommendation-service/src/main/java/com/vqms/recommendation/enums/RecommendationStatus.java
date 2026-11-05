package com.vqms.recommendation.enums;

/**
 * GENERATED              - recommendation ready, no open review points.
 * NEEDS_REVIEW           - review points exist (missing data, high risk, no qualifying vendor).
 * SUBMITTED_FOR_APPROVAL - sent to the Approval Service (approval/rejection happens there, never here).
 * SUPERSEDED             - replaced by a regenerated recommendation.
 */
public enum RecommendationStatus {
    GENERATED,
    NEEDS_REVIEW,
    SUBMITTED_FOR_APPROVAL,
    SUPERSEDED
}
