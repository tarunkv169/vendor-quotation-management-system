-- =====================================================================
-- V1: recommendations + recommendation_items
-- =====================================================================

CREATE TABLE recommendations (
    id                          UUID            PRIMARY KEY,
    recommendation_number       VARCHAR(40)     NOT NULL,
    procurement_request_id      UUID            NOT NULL,
    comparison_id               UUID            NOT NULL,
    comparison_number           VARCHAR(40),
    status                      VARCHAR(30)     NOT NULL,
    recommendation_type         VARCHAR(40)     NOT NULL,
    policy_code                 VARCHAR(40)     NOT NULL,
    currency_code               VARCHAR(3),
    criteria_weights            JSONB           NOT NULL,
    excluded_criteria           JSONB,
    recommended_quotation_id    UUID,
    recommended_vendor_id       UUID,
    overall_score               NUMERIC(9, 4),
    risk_level                  VARCHAR(20),
    requires_review             BOOLEAN         NOT NULL DEFAULT FALSE,
    review_reasons              JSONB,
    explanation                 TEXT,
    previous_recommendation_id  UUID,
    source_event_id             UUID,
    generated_by                UUID,
    generated_at                TIMESTAMP WITH TIME ZONE NOT NULL,
    submitted_by                UUID,
    submitted_at                TIMESTAMP WITH TIME ZONE,
    submission_comment          VARCHAR(1000),
    created_at                  TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at                  TIMESTAMP WITH TIME ZONE NOT NULL,
    version                     BIGINT          NOT NULL DEFAULT 0,

    CONSTRAINT uk_recommendations_number UNIQUE (recommendation_number),
    CONSTRAINT ck_recommendations_status CHECK (status IN
        ('GENERATED','NEEDS_REVIEW','SUBMITTED_FOR_APPROVAL','SUPERSEDED')),
    CONSTRAINT ck_recommendations_risk CHECK (risk_level IS NULL OR risk_level IN ('LOW','MEDIUM','HIGH','CRITICAL'))
);
CREATE INDEX idx_recommendations_procurement ON recommendations (procurement_request_id, created_at DESC);
CREATE INDEX idx_recommendations_comparison ON recommendations (comparison_id);
CREATE INDEX idx_recommendations_status ON recommendations (status);
CREATE UNIQUE INDEX uk_recommendations_source_event ON recommendations (source_event_id)
    WHERE source_event_id IS NOT NULL;

CREATE TABLE recommendation_items (
    id                    UUID           PRIMARY KEY,
    recommendation_id     UUID           NOT NULL REFERENCES recommendations (id) ON DELETE CASCADE,
    quotation_id          UUID           NOT NULL,
    vendor_id             UUID,
    eligible              BOOLEAN        NOT NULL,
    eligibility_reasons   JSONB,
    recommendation_role   VARCHAR(20)    NOT NULL,
    total_amount          NUMERIC(19, 4),
    criterion_scores      JSONB,
    missing_criteria      JSONB,
    overall_score         NUMERIC(9, 4),
    rank_position         INTEGER,
    risk_level            VARCHAR(20)    NOT NULL,
    risk_factors          JSONB,
    explanation           TEXT,
    created_at            TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at            TIMESTAMP WITH TIME ZONE NOT NULL,
    version               BIGINT         NOT NULL DEFAULT 0,

    CONSTRAINT uk_recommendation_items_quotation UNIQUE (recommendation_id, quotation_id),
    CONSTRAINT ck_recommendation_items_role CHECK (recommendation_role IN ('PRIMARY','ALTERNATIVE','NOT_RECOMMENDED'))
);
CREATE INDEX idx_recommendation_items_recommendation ON recommendation_items (recommendation_id);
