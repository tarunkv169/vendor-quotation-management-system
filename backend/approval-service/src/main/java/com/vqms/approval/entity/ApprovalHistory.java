package com.vqms.approval.entity;

import com.vqms.approval.entity.base.BaseEntity;
import com.vqms.approval.enums.ApprovalAction;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.UUID;

/** Append-only audit trail of everything that happened to an approval. */
@Entity
@Table(name = "approval_history")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ApprovalHistory extends BaseEntity {

    @Column(name = "approval_id", nullable = false, updatable = false)
    private UUID approvalId;

    @Column(name = "step_id", updatable = false)
    private UUID stepId;

    @Enumerated(EnumType.STRING)
    @Column(name = "action", nullable = false, length = 30, updatable = false)
    private ApprovalAction action;

    /** Null for system actions (e.g. automatic escalation). */
    @Column(name = "actor_id", updatable = false)
    private UUID actorId;

    @Column(name = "on_behalf_of", updatable = false)
    private UUID onBehalfOf;

    @Column(name = "comment", length = 1000, updatable = false)
    private String comment;

    public ApprovalHistory(UUID approvalId, UUID stepId, ApprovalAction action, UUID actorId, UUID onBehalfOf,
                           String comment) {
        this.approvalId = approvalId;
        this.stepId = stepId;
        this.action = action;
        this.actorId = actorId;
        this.onBehalfOf = onBehalfOf;
        this.comment = comment == null || comment.length() <= 1000 ? comment : comment.substring(0, 1000);
    }
}
