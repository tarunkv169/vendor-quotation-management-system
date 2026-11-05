-- =====================================================================
-- V1: comparisons + comparison_items
-- =====================================================================

CREATE TABLE comparisons (
    id                        UUID            PRIMARY KEY,
    comparison_number         VARCHAR(40)     NOT NULL,
    procurement_request_id    UUID            NOT NULL,
    status                    VARCHAR(20)     NOT NULL,
    currency_code             VARCHAR(3),
    criteria_weights          JSONB           NOT NULL,
    minimum_scores            JSONB,
    manual_scores             JSONB,
    requested_quotation_ids   JSONB,
    require_all_items         BOOLEAN         NOT NULL DEFAULT FALSE,
    excluded_criteria         JSONB,
    line_comparisons          JSONB,
    requires_review           BOOLEAN         NOT NULL DEFAULT FALSE,
    stale                     BOOLEAN         NOT NULL DEFAULT FALSE,
    eligible_count            INTEGER         NOT NULL DEFAULT 0,
    lowest_quotation_id       UUID,
    recommended_quotation_id  UUID,
    failure_reason            VARCHAR(1000),
    created_by                UUID            NOT NULL,
    calculated_at             TIMESTAMP WITH TIME ZONE,
    completed_at              TIMESTAMP WITH TIME ZONE,
    created_at                TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at                TIMESTAMP WITH TIME ZONE NOT NULL,
    version                   BIGINT          NOT NULL DEFAULT 0,

    CONSTRAINT uk_comparisons_number UNIQUE (comparison_number),
    CONSTRAINT ck_comparisons_status CHECK (status IN ('CREATED','CALCULATED','COMPLETED','FAILED'))
);
CREATE INDEX idx_comparisons_procurement ON comparisons (procurement_request_id, created_at DESC);
CREATE INDEX idx_comparisons_status ON comparisons (status);

CREATE TABLE comparison_items (
    id                         UUID           PRIMARY KEY,
    comparison_id              UUID           NOT NULL REFERENCES comparisons (id) ON DELETE CASCADE,
    quotation_id               UUID           NOT NULL,
    vendor_id                  UUID,
    quotation_number           VARCHAR(100),
    validation_id              UUID,
    result_type                VARCHAR(20)    NOT NULL,
    eligibility_reasons        JSONB,
    currency_code              VARCHAR(3),
    subtotal                   NUMERIC(19, 4),
    discount_amount            NUMERIC(19, 4),
    tax_amount                 NUMERIC(19, 4),
    total_amount               NUMERIC(19, 4),
    max_delivery_days          INTEGER,
    min_warranty_months        INTEGER,
    item_coverage_percent      NUMERIC(7, 4),
    criterion_scores           JSONB,
    missing_criteria           JSONB,
    overall_score              NUMERIC(9, 4),
    rank_position              INTEGER,
    lowest_price               BOOLEAN        NOT NULL DEFAULT FALSE,
    difference_from_lowest     NUMERIC(19, 4),
    difference_percent         NUMERIC(9, 4),
    created_at                 TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at                 TIMESTAMP WITH TIME ZONE NOT NULL,
    version                    BIGINT         NOT NULL DEFAULT 0,

    CONSTRAINT uk_comparison_items_quotation UNIQUE (comparison_id, quotation_id),
    CONSTRAINT ck_comparison_items_result CHECK (result_type IN ('RANKED','INELIGIBLE','INCOMPARABLE'))
);
CREATE INDEX idx_comparison_items_comparison ON comparison_items (comparison_id);
CREATE INDEX idx_comparison_items_quotation ON comparison_items (quotation_id);
