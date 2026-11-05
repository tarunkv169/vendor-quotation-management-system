-- Transactional outbox: events written with the business change, relayed to Kafka.
CREATE TABLE outbox_events (
    id              UUID            PRIMARY KEY,
    aggregate_type  VARCHAR(50)     NOT NULL,
    aggregate_id    UUID            NOT NULL,
    event_type      VARCHAR(80)     NOT NULL,
    topic           VARCHAR(120)    NOT NULL,
    payload         TEXT            NOT NULL,
    correlation_id  VARCHAR(64),
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL,
    published_at    TIMESTAMP WITH TIME ZONE,
    attempts        INTEGER         NOT NULL DEFAULT 0,
    last_error      VARCHAR(1000)
);
CREATE INDEX idx_outbox_events_unpublished ON outbox_events (created_at) WHERE published_at IS NULL;

-- Inbox: ids of consumed messages for idempotent processing.
CREATE TABLE processed_messages (
    message_id    UUID          PRIMARY KEY,
    consumer      VARCHAR(80)   NOT NULL,
    processed_at  TIMESTAMP WITH TIME ZONE NOT NULL
);
