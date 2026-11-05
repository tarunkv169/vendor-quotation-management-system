-- =====================================================================
-- V1: generated report snapshots
-- =====================================================================

CREATE TABLE reports (
    id               UUID            PRIMARY KEY,
    report_number    VARCHAR(40)     NOT NULL,
    report_type      VARCHAR(40)     NOT NULL,
    status           VARCHAR(20)     NOT NULL,
    parameters       JSONB           NOT NULL,
    data             JSONB,
    warnings         JSONB,
    row_count        INTEGER         NOT NULL DEFAULT 0,
    failure_reason   VARCHAR(1000),
    generated_by     UUID            NOT NULL,
    generated_at     TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_ms      BIGINT          NOT NULL,
    created_at       TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at       TIMESTAMP WITH TIME ZONE NOT NULL,
    version          BIGINT          NOT NULL DEFAULT 0,
    CONSTRAINT uk_reports_number UNIQUE (report_number),
    CONSTRAINT ck_reports_status CHECK (status IN ('COMPLETED','PARTIAL','FAILED')),
    CONSTRAINT ck_reports_type CHECK (report_type IN ('PROCUREMENT_SUMMARY','APPROVAL_SPEND','VALIDATION_QUALITY'))
);
CREATE INDEX idx_reports_type ON reports (report_type, generated_at DESC);
CREATE INDEX idx_reports_generated_by ON reports (generated_by, generated_at DESC);
