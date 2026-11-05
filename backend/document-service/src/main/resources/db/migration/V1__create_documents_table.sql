-- =====================================================================
-- V1: documents + document_status_history
-- =====================================================================

CREATE TABLE documents (
    id                      UUID            PRIMARY KEY,
    document_name           VARCHAR(255)    NOT NULL,
    stored_file_name        VARCHAR(100)    NOT NULL,
    document_type           VARCHAR(50)     NOT NULL,
    document_status         VARCHAR(30)     NOT NULL,
    owner_id                UUID            NOT NULL,
    vendor_id               UUID,
    quotation_id            UUID,
    procurement_request_id  UUID,
    storage_key             VARCHAR(512)    NOT NULL,
    bucket_name             VARCHAR(63)     NOT NULL,
    content_type            VARCHAR(150)    NOT NULL,
    file_size               BIGINT          NOT NULL,
    checksum                VARCHAR(64)     NOT NULL,
    description             VARCHAR(500),
    failure_reason          VARCHAR(1000),
    deleted_at              TIMESTAMP WITH TIME ZONE,
    deleted_by              UUID,
    created_at              TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at              TIMESTAMP WITH TIME ZONE NOT NULL,
    version                 BIGINT          NOT NULL DEFAULT 0,

    CONSTRAINT uk_documents_storage_key UNIQUE (storage_key),
    CONSTRAINT ck_documents_file_size CHECK (file_size > 0),
    CONSTRAINT ck_documents_checksum CHECK (checksum ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_documents_type CHECK (document_type IN (
        'QUOTATION_PDF', 'QUOTATION_EXCEL', 'VENDOR_CERTIFICATE',
        'SUPPORTING_DOCUMENT', 'PROCUREMENT_ATTACHMENT')),
    CONSTRAINT ck_documents_status CHECK (document_status IN (
        'UPLOADING', 'PENDING_SCAN', 'ACTIVE', 'PROCESSING', 'PROCESSED',
        'FAILED', 'UPLOAD_FAILED', 'QUARANTINED', 'DELETED')),
    CONSTRAINT ck_documents_has_reference CHECK (
        quotation_id IS NOT NULL OR vendor_id IS NOT NULL OR procurement_request_id IS NOT NULL)
);

-- Lookup indexes for the list endpoints.
CREATE INDEX idx_documents_quotation_id ON documents (quotation_id);
CREATE INDEX idx_documents_vendor_id ON documents (vendor_id);
CREATE INDEX idx_documents_procurement_request_id ON documents (procurement_request_id);
CREATE INDEX idx_documents_owner_id ON documents (owner_id);
CREATE INDEX idx_documents_status_created_at ON documents (document_status, created_at);

-- Duplicate protection (same file content for the same reference).
-- Partial indexes ignore deleted and failed uploads so a file can be re-uploaded.
CREATE UNIQUE INDEX uk_documents_quotation_checksum
    ON documents (quotation_id, checksum)
    WHERE quotation_id IS NOT NULL
      AND document_status NOT IN ('DELETED', 'UPLOAD_FAILED');

CREATE UNIQUE INDEX uk_documents_vendor_checksum
    ON documents (vendor_id, checksum)
    WHERE quotation_id IS NULL
      AND vendor_id IS NOT NULL
      AND document_status NOT IN ('DELETED', 'UPLOAD_FAILED');

CREATE UNIQUE INDEX uk_documents_procurement_checksum
    ON documents (procurement_request_id, checksum)
    WHERE quotation_id IS NULL
      AND vendor_id IS NULL
      AND procurement_request_id IS NOT NULL
      AND document_status NOT IN ('DELETED', 'UPLOAD_FAILED');

CREATE TABLE document_status_history (
    id           UUID          PRIMARY KEY,
    document_id  UUID          NOT NULL REFERENCES documents (id),
    from_status  VARCHAR(30),
    to_status    VARCHAR(30)   NOT NULL,
    changed_by   UUID,
    reason       VARCHAR(1000),
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at   TIMESTAMP WITH TIME ZONE NOT NULL,
    version      BIGINT        NOT NULL DEFAULT 0
);

CREATE INDEX idx_document_status_history_document_id
    ON document_status_history (document_id, created_at);
