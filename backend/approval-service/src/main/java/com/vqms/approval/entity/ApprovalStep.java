package com.vqms.approval.entity;

import com.vqms.approval.entity.base.BaseEntity;
import com.vqms.approval.entity.json.PolicyLevel;
import com.vqms.approval.enums.ApprovalLevel;
import com.vqms.approval.enums.ApprovalStepStatus;
import com.vqms.approval.exception.InvalidApprovalStateException;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/** One approval level of an approval request, with its own deadline and decision. */
@Entity
@Table(name = "approval_steps")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ApprovalStep extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "approval_id", nullable = false)
    private Approval approval;

    @Column(name = "level_number", nullable = false)
    private int levelNumber;

    @Enumerated(EnumType.STRING)
    @Column(name = "approval_level", nullable = false, length = 20)
    private ApprovalLevel level;

    @Column(name = "required_role", nullable = false, length = 40)
    private String requiredRole;

    @Column(name = "approval_limit", nullable = false, precision = 19, scale = 4)
    private BigDecimal approvalLimit;

    @Column(name = "deadline_hours", nullable = false)
    private int deadlineHours;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private ApprovalStepStatus status;

    @Column(name = "activated_at")
    private Instant activatedAt;

    @Column(name = "due_at")
    private Instant dueAt;

    @Column(name = "escalated", nullable = false)
    private boolean escalated;

    @Column(name = "escalated_at")
    private Instant escalatedAt;

    /** After escalation, users with this role may also decide the step. */
    @Column(name = "escalation_role", length = 40)
    private String escalationRole;

    @Column(name = "decided_by")
    private UUID decidedBy;

    /** Set when the decision was taken by a delegate on behalf of this user. */
    @Column(name = "on_behalf_of")
    private UUID onBehalfOf;

    @Column(name = "decided_at")
    private Instant decidedAt;

    @Column(name = "decision_comment", length = 1000)
    private String decisionComment;

    ApprovalStep(Approval approval, PolicyLevel level) {
        this.approval = approval;
        this.levelNumber = level.levelNumber();
        this.level = level.level();
        this.requiredRole = level.requiredRole();
        this.approvalLimit = level.approvalLimit();
        this.deadlineHours = level.deadlineHours();
        this.status = ApprovalStepStatus.WAITING;
    }

    void activate(Instant now) {
        this.status = ApprovalStepStatus.PENDING;
        this.activatedAt = now;
        this.dueAt = now.plus(Duration.ofHours(deadlineHours));
    }

    void decide(ApprovalStepStatus outcome, UUID actorId, UUID onBehalfOf, String comment, Instant now) {
        if (status != ApprovalStepStatus.PENDING) {
            throw new InvalidApprovalStateException("Level " + levelNumber + " is not awaiting a decision");
        }
        this.status = outcome;
        this.decidedBy = actorId;
        this.onBehalfOf = onBehalfOf;
        this.decisionComment = comment;
        this.decidedAt = now;
    }

    void cancel() {
        if (status == ApprovalStepStatus.WAITING || status == ApprovalStepStatus.PENDING) {
            this.status = ApprovalStepStatus.CANCELLED;
        }
    }

    public void escalate(String role, int extensionHours, Instant now) {
        if (status != ApprovalStepStatus.PENDING) {
            throw new InvalidApprovalStateException("Only pending levels can be escalated");
        }
        this.escalated = true;
        this.escalatedAt = now;
        this.escalationRole = role;
        this.dueAt = now.plus(Duration.ofHours(extensionHours));
    }

    public boolean isOverdue(Instant now) {
        return status == ApprovalStepStatus.PENDING && dueAt != null && dueAt.isBefore(now);
    }

    /** Effective decision maker for segregation-of-duties checks. */
    public UUID accountableUser() {
        return onBehalfOf != null ? onBehalfOf : decidedBy;
    }
}
