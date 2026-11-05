package com.vqms.approval.entity;

import com.vqms.approval.entity.base.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

/**
 * Temporary delegation of a user's approval authority (e.g. during leave). The delegate may decide
 * steps requiring {@code delegatorRole} within the validity window; decisions record "on behalf of".
 */
@Entity
@Table(name = "approval_delegations")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ApprovalDelegation extends BaseEntity {

    @Column(name = "delegator_id", nullable = false, updatable = false)
    private UUID delegatorId;

    @Column(name = "delegator_role", nullable = false, length = 40, updatable = false)
    private String delegatorRole;

    @Column(name = "delegate_id", nullable = false, updatable = false)
    private UUID delegateId;

    @Column(name = "valid_from", nullable = false)
    private Instant validFrom;

    @Column(name = "valid_until", nullable = false)
    private Instant validUntil;

    @Column(name = "reason", nullable = false, length = 500)
    private String reason;

    @Column(name = "active", nullable = false)
    private boolean active;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    public ApprovalDelegation(UUID delegatorId, String delegatorRole, UUID delegateId, Instant validFrom,
                              Instant validUntil, String reason) {
        this.delegatorId = delegatorId;
        this.delegatorRole = delegatorRole;
        this.delegateId = delegateId;
        this.validFrom = validFrom;
        this.validUntil = validUntil;
        this.reason = reason;
        this.active = true;
    }

    public boolean isEffective(Instant now) {
        return active && !now.isBefore(validFrom) && now.isBefore(validUntil);
    }

    public void revoke(Instant now) {
        this.active = false;
        this.revokedAt = now;
    }
}
