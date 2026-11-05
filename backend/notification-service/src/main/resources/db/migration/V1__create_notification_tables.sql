-- =====================================================================
-- V1: notifications (user- or role-targeted) + per-user read receipts
-- =====================================================================

CREATE TABLE notifications (
    id                 UUID            PRIMARY KEY,
    recipient_user_id  UUID,
    recipient_role     VARCHAR(40),
    category           VARCHAR(40)     NOT NULL,
    priority           VARCHAR(10)     NOT NULL,
    title              VARCHAR(200)    NOT NULL,
    message            VARCHAR(2000)   NOT NULL,
    reference_type     VARCHAR(50),
    reference_id       UUID,
    dedupe_key         VARCHAR(200),
    email_status       VARCHAR(20)     NOT NULL,
    email_attempts     INTEGER         NOT NULL DEFAULT 0,
    last_email_error   VARCHAR(500),
    created_by         UUID,
    created_at         TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at         TIMESTAMP WITH TIME ZONE NOT NULL,
    version            BIGINT          NOT NULL DEFAULT 0,
    -- exactly one target: a user or a role
    CONSTRAINT ck_notifications_target CHECK ((recipient_user_id IS NULL) <> (recipient_role IS NULL)),
    CONSTRAINT ck_notifications_email_status CHECK (email_status IN ('NOT_REQUESTED','PENDING','SENT','FAILED'))
);
CREATE INDEX idx_notifications_user ON notifications (recipient_user_id, created_at DESC);
CREATE INDEX idx_notifications_role ON notifications (recipient_role, created_at DESC);
CREATE INDEX idx_notifications_email ON notifications (email_status) WHERE email_status IN ('PENDING','FAILED');
CREATE UNIQUE INDEX uk_notifications_dedupe ON notifications (dedupe_key) WHERE dedupe_key IS NOT NULL;

CREATE TABLE notification_reads (
    id               UUID   PRIMARY KEY,
    notification_id  UUID   NOT NULL REFERENCES notifications (id) ON DELETE CASCADE,
    user_id          UUID   NOT NULL,
    read_at          TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at       TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at       TIMESTAMP WITH TIME ZONE NOT NULL,
    version          BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uk_notification_reads UNIQUE (notification_id, user_id)
);
CREATE INDEX idx_notification_reads_user ON notification_reads (user_id);
