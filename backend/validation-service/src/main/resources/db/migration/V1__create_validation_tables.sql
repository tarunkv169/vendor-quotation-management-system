-- =====================================================================
-- V1: validation_records + validation_issues
-- =====================================================================

CREATE TABLE validation_records (
    id                      UUID            PRIMARY KEY,
    quotation_id            UUID,
    quotation_number        VARCHAR(100),
    quotation_version       BIGINT,
    vendor_id               UUID,
    procurement_request_id  UUID,
    extraction_id           UUID,
    document_id             UUID,
    status                  VARCHAR(20)     NOT NULL,
    validation_trigger      VARCHAR(30)     NOT NULL,
    requested_by            UUID,
    previous_validation_id  UUID,
    source_event_id         UUID,
    currency_code           VARCHAR(3),
    expected_subtotal       NUMERIC(19, 4),
    expected_discount       NUMERIC(19, 4),
    expected_tax            NUMERIC(19, 4),
    expected_total          NUMERIC(19, 4),
    quoted_total            NUMERIC(19, 4),
    error_count             INTEGER         NOT NULL DEFAULT 0,
    warning_count           INTEGER         NOT NULL DEFAULT 0,
    info_count              INTEGER         NOT NULL DEFAULT 0,
    summary                 VARCHAR(500),
    extraction_snapshot     TEXT,
    validated_at            TIMESTAMP WITH TIME ZONE,
    created_at              TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at              TIMESTAMP WITH TIME ZONE NOT NULL,
    version                 BIGINT          NOT NULL DEFAULT 0,

    CONSTRAINT ck_validation_status CHECK (status IN ('PENDING','IN_PROGRESS','PASSED','FAILED','NEEDS_REVIEW')),
    CONSTRAINT ck_validation_trigger CHECK (validation_trigger IN ('MANUAL','EXTRACTION_EVENT','REVALIDATION'))
);

CREATE INDEX idx_validation_records_quotation ON validation_records (quotation_id, created_at DESC);
CREATE INDEX idx_validation_records_status ON validation_records (status, created_at DESC);
CREATE INDEX idx_validation_records_vendor ON validation_records (vendor_id);
CREATE INDEX idx_validation_records_procurement ON validation_records (procurement_request_id);
-- One validation per consumed extraction event (idempotency backstop).
CREATE UNIQUE INDEX uk_validation_records_source_event
    ON validation_records (source_event_id) WHERE source_event_id IS NOT NULL;

CREATE TABLE validation_issues (
    id                    UUID           PRIMARY KEY,
    validation_record_id  UUID           NOT NULL REFERENCES validation_records (id) ON DELETE CASCADE,
    validation_type       VARCHAR(40)    NOT NULL,
    issue_code            VARCHAR(60)    NOT NULL,
    severity              VARCHAR(10)    NOT NULL,
    message               VARCHAR(1000)  NOT NULL,
    field_path            VARCHAR(200),
    expected_value        VARCHAR(255),
    actual_value          VARCHAR(255),
    created_at            TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at            TIMESTAMP WITH TIME ZONE NOT NULL,
    version               BIGINT         NOT NULL DEFAULT 0,

    CONSTRAINT ck_validation_issue_severity CHECK (severity IN ('ERROR','WARNING','INFO'))
);

CREATE INDEX idx_validation_issues_record ON validation_issues (validation_record_id);
