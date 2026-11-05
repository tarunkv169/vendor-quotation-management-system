-- =====================================================================
-- V1: approval policies, approvals, steps, history, delegations
-- =====================================================================

CREATE TABLE approval_policies (
    id                UUID            PRIMARY KEY,
    code              VARCHAR(40)     NOT NULL,
    name              VARCHAR(150)    NOT NULL,
    description       VARCHAR(500),
    currency_code     VARCHAR(3)      NOT NULL,
    min_amount        NUMERIC(19, 4)  NOT NULL,
    max_amount        NUMERIC(19, 4),
    approval_mode     VARCHAR(20)     NOT NULL,
    levels            JSONB           NOT NULL,
    escalation_role   VARCHAR(40)     NOT NULL,
    escalation_hours  INTEGER         NOT NULL,
    priority          INTEGER         NOT NULL DEFAULT 0,
    active            BOOLEAN         NOT NULL DEFAULT TRUE,
    created_by        UUID,
    created_at        TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at        TIMESTAMP WITH TIME ZONE NOT NULL,
    version           BIGINT          NOT NULL DEFAULT 0,
    CONSTRAINT uk_approval_policies_code UNIQUE (code),
    CONSTRAINT ck_approval_policies_amounts CHECK (max_amount IS NULL OR max_amount >= min_amount),
    CONSTRAINT ck_approval_policies_mode CHECK (approval_mode IN ('SEQUENTIAL','PARALLEL'))
);

CREATE TABLE approvals (
    id                      UUID            PRIMARY KEY,
    approval_number         VARCHAR(40)     NOT NULL,
    recommendation_id       UUID            NOT NULL,
    recommendation_number   VARCHAR(40),
    comparison_id           UUID,
    procurement_request_id  UUID            NOT NULL,
    quotation_id            UUID            NOT NULL,
    vendor_id               UUID,
    amount                  NUMERIC(19, 4)  NOT NULL,
    currency_code           VARCHAR(3)      NOT NULL,
    status                  VARCHAR(20)     NOT NULL,
    approval_mode           VARCHAR(20)     NOT NULL,
    policy_id               UUID            NOT NULL,
    policy_code             VARCHAR(40)     NOT NULL,
    submitted_by            UUID,
    requester_id            UUID,
    risk_level              VARCHAR(20),
    requires_review         BOOLEAN         NOT NULL DEFAULT FALSE,
    review_reasons          JSONB,
    source_event_id         UUID,
    decided_at              TIMESTAMP WITH TIME ZONE,
    final_comment           VARCHAR(1000),
    created_at              TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at              TIMESTAMP WITH TIME ZONE NOT NULL,
    version                 BIGINT          NOT NULL DEFAULT 0,
    CONSTRAINT uk_approvals_number UNIQUE (approval_number),
    CONSTRAINT ck_approvals_status CHECK (status IN ('PENDING','IN_PROGRESS','APPROVED','REJECTED','CANCELLED')),
    CONSTRAINT ck_approvals_amount CHECK (amount > 0)
);
CREATE INDEX idx_approvals_status ON approvals (status);
CREATE INDEX idx_approvals_procurement ON approvals (procurement_request_id);
-- At most one open approval per recommendation; one approval per consumed event.
CREATE UNIQUE INDEX uk_approvals_open_recommendation ON approvals (recommendation_id)
    WHERE status IN ('PENDING','IN_PROGRESS','APPROVED');
CREATE UNIQUE INDEX uk_approvals_source_event ON approvals (source_event_id) WHERE source_event_id IS NOT NULL;

CREATE TABLE approval_steps (
    id                  UUID            PRIMARY KEY,
    approval_id         UUID            NOT NULL REFERENCES approvals (id) ON DELETE CASCADE,
    level_number        INTEGER         NOT NULL,
    approval_level      VARCHAR(20)     NOT NULL,
    required_role       VARCHAR(40)     NOT NULL,
    approval_limit      NUMERIC(19, 4)  NOT NULL,
    deadline_hours      INTEGER         NOT NULL,
    status              VARCHAR(20)     NOT NULL,
    activated_at        TIMESTAMP WITH TIME ZONE,
    due_at              TIMESTAMP WITH TIME ZONE,
    escalated           BOOLEAN         NOT NULL DEFAULT FALSE,
    escalated_at        TIMESTAMP WITH TIME ZONE,
    escalation_role     VARCHAR(40),
    decided_by          UUID,
    on_behalf_of        UUID,
    decided_at          TIMESTAMP WITH TIME ZONE,
    decision_comment    VARCHAR(1000),
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL,
    version             BIGINT          NOT NULL DEFAULT 0,
    CONSTRAINT uk_approval_steps_level UNIQUE (approval_id, level_number),
    CONSTRAINT ck_approval_steps_status CHECK (status IN ('WAITING','PENDING','APPROVED','REJECTED','CANCELLED'))
);
CREATE INDEX idx_approval_steps_pending ON approval_steps (status, due_at);

CREATE TABLE approval_history (
    id            UUID           PRIMARY KEY,
    approval_id   UUID           NOT NULL REFERENCES approvals (id) ON DELETE CASCADE,
    step_id       UUID,
    action        VARCHAR(30)    NOT NULL,
    actor_id      UUID,
    on_behalf_of  UUID,
    comment       VARCHAR(1000),
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at    TIMESTAMP WITH TIME ZONE NOT NULL,
    version       BIGINT         NOT NULL DEFAULT 0
);
CREATE INDEX idx_approval_history_approval ON approval_history (approval_id, created_at);

CREATE TABLE approval_delegations (
    id              UUID           PRIMARY KEY,
    delegator_id    UUID           NOT NULL,
    delegator_role  VARCHAR(40)    NOT NULL,
    delegate_id     UUID           NOT NULL,
    valid_from      TIMESTAMP WITH TIME ZONE NOT NULL,
    valid_until     TIMESTAMP WITH TIME ZONE NOT NULL,
    reason          VARCHAR(500)   NOT NULL,
    active          BOOLEAN        NOT NULL DEFAULT TRUE,
    revoked_at      TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL,
    version         BIGINT         NOT NULL DEFAULT 0,
    CONSTRAINT ck_delegations_period CHECK (valid_until > valid_from),
    CONSTRAINT ck_delegations_self CHECK (delegator_id <> delegate_id)
);
CREATE INDEX idx_delegations_delegate ON approval_delegations (delegate_id, active);
