-- =====================================================================
-- V1: append-only, hash-chained audit trail
-- =====================================================================

CREATE TABLE audit_events (
    id              UUID            PRIMARY KEY,
    sequence_number BIGINT          NOT NULL,
    event_id        UUID            NOT NULL,
    source_service  VARCHAR(60)     NOT NULL,
    event_type      VARCHAR(80)     NOT NULL,
    aggregate_type  VARCHAR(50),
    aggregate_id    UUID,
    actor_id        UUID,
    actor_role      VARCHAR(40),
    outcome         VARCHAR(20)     NOT NULL,
    description     VARCHAR(1000),
    correlation_id  VARCHAR(64),
    payload         TEXT,
    occurred_at     TIMESTAMP WITH TIME ZONE NOT NULL,
    recorded_at     TIMESTAMP WITH TIME ZONE NOT NULL,
    previous_hash   VARCHAR(64)     NOT NULL,
    hash            VARCHAR(64)     NOT NULL,
    CONSTRAINT uk_audit_events_sequence UNIQUE (sequence_number),
    CONSTRAINT uk_audit_events_event_id UNIQUE (event_id),
    CONSTRAINT ck_audit_events_outcome CHECK (outcome IN ('SUCCESS','FAILURE','INFO'))
);
CREATE INDEX idx_audit_events_aggregate ON audit_events (aggregate_type, aggregate_id, sequence_number);
CREATE INDEX idx_audit_events_actor ON audit_events (actor_id, occurred_at);
CREATE INDEX idx_audit_events_occurred ON audit_events (occurred_at);
CREATE INDEX idx_audit_events_source_type ON audit_events (source_service, event_type);

-- Single-row head of the hash chain; locked FOR UPDATE on every append to serialize writers.
CREATE TABLE audit_chain_head (
    id             SMALLINT     PRIMARY KEY,
    last_sequence  BIGINT       NOT NULL,
    last_hash      VARCHAR(64)  NOT NULL,
    CONSTRAINT ck_audit_chain_head_single CHECK (id = 1)
);
INSERT INTO audit_chain_head (id, last_sequence, last_hash)
VALUES (1, 0, '0000000000000000000000000000000000000000000000000000000000000000');

-- Database-level immutability: audit rows can never be changed or removed, even by the application.
CREATE FUNCTION audit_events_immutable() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'audit_events is append-only (% is not allowed)', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_events_immutable
    BEFORE UPDATE OR DELETE ON audit_events
    FOR EACH ROW EXECUTE FUNCTION audit_events_immutable();
