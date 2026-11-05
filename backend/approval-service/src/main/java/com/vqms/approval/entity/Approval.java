package com.vqms.approval.entity;

import com.vqms.approval.entity.base.BaseEntity;
import com.vqms.approval.entity.json.PolicyLevel;
import com.vqms.approval.enums.ApprovalMode;
import com.vqms.approval.enums.ApprovalStatus;
import com.vqms.approval.enums.ApprovalStepStatus;
import com.vqms.approval.exception.ApprovalPolicyException;
import com.vqms.approval.exception.InvalidApprovalStateException;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Approval request for one recommended quotation. The aggregate enforces the workflow rules:
 * sequential/parallel progression, rejection ends the approval, and the final approval requires
 * that some approving level is authorised for the full amount (approval limits).
 */
@Entity
@Table(name = "approvals")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Approval extends BaseEntity {

    @Column(name = "approval_number", nullable = false, length = 40, unique = true)
    private String approvalNumber;

    @Column(name = "recommendation_id", nullable = false)
    private UUID recommendationId;

    @Column(name = "recommendation_number", length = 40)
    private String recommendationNumber;

    @Column(name = "comparison_id")
    private UUID comparisonId;

    @Column(name = "procurement_request_id", nullable = false)
    private UUID procurementRequestId;

    @Column(name = "quotation_id", nullable = false)
    private UUID quotationId;

    @Column(name = "vendor_id")
    private UUID vendorId;

    @Column(name = "amount", nullable = false, precision = 19, scale = 4)
    private BigDecimal amount;

    @Column(name = "currency_code", nullable = false, length = 3)
    private String currencyCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private ApprovalStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "approval_mode", nullable = false, length = 20)
    private ApprovalMode mode;

    @Column(name = "policy_id", nullable = false)
    private UUID policyId;

    @Column(name = "policy_code", nullable = false, length = 40)
    private String policyCode;

    /** Who submitted the recommendation - may never approve it. */
    @Column(name = "submitted_by")
    private UUID submittedBy;

    /** Who raised the procurement request - may never approve it. */
    @Column(name = "requester_id")
    private UUID requesterId;

    @Column(name = "risk_level", length = 20)
    private String riskLevel;

    @Column(name = "requires_review", nullable = false)
    private boolean requiresReview;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "review_reasons", columnDefinition = "jsonb")
    private List<String> reviewReasons;

    @Column(name = "source_event_id")
    private UUID sourceEventId;

    @Column(name = "decided_at")
    private Instant decidedAt;

    @Column(name = "final_comment", length = 1000)
    private String finalComment;

    @OneToMany(mappedBy = "approval", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("levelNumber ASC")
    private List<ApprovalStep> steps = new ArrayList<>();

    @Builder
    private Approval(String approvalNumber, UUID recommendationId, String recommendationNumber, UUID comparisonId,
                     UUID procurementRequestId, UUID quotationId, UUID vendorId, BigDecimal amount,
                     String currencyCode, UUID submittedBy, UUID requesterId, String riskLevel,
                     boolean requiresReview, List<String> reviewReasons, UUID sourceEventId,
                     ApprovalPolicy policy) {
        this.approvalNumber = approvalNumber;
        this.recommendationId = recommendationId;
        this.recommendationNumber = recommendationNumber;
        this.comparisonId = comparisonId;
        this.procurementRequestId = procurementRequestId;
        this.quotationId = quotationId;
        this.vendorId = vendorId;
        this.amount = amount;
        this.currencyCode = currencyCode;
        this.submittedBy = submittedBy;
        this.requesterId = requesterId;
        this.riskLevel = riskLevel;
        this.requiresReview = requiresReview;
        this.reviewReasons = reviewReasons == null ? List.of() : List.copyOf(reviewReasons);
        this.sourceEventId = sourceEventId;
        this.policyId = policy.getId();
        this.policyCode = policy.getCode();
        this.mode = policy.getMode();
        this.status = ApprovalStatus.PENDING;
        boolean authorised = policy.getLevels().stream().anyMatch(l -> l.approvalLimit().compareTo(amount) >= 0);
        if (!authorised) {
            throw new ApprovalPolicyException("Policy " + policy.getCode() + " has no level authorised for "
                    + amount.toPlainString() + " " + currencyCode);
        }
        policy.getLevels().stream().sorted(Comparator.comparingInt(PolicyLevel::levelNumber))
                .forEach(level -> steps.add(new ApprovalStep(this, level)));
    }

    /** Opens the first level (sequential) or all levels (parallel). Returns the activated steps. */
    public List<ApprovalStep> start(Instant now) {
        if (mode == ApprovalMode.PARALLEL) {
            steps.forEach(step -> step.activate(now));
            return List.copyOf(steps);
        }
        steps.get(0).activate(now);
        return List.of(steps.get(0));
    }

    /** Records an approval. Returns the newly activated step (sequential), if any. */
    public Optional<ApprovalStep> approve(ApprovalStep step, UUID actorId, UUID onBehalfOf, String comment, Instant now) {
        assertOpen();
        step.decide(ApprovalStepStatus.APPROVED, actorId, onBehalfOf, comment, now);
        Optional<ApprovalStep> next = mode == ApprovalMode.SEQUENTIAL
                ? steps.stream().filter(s -> s.getStatus() == ApprovalStepStatus.WAITING).findFirst()
                : Optional.empty();
        if (next.isPresent()) {
            next.get().activate(now);
            status = ApprovalStatus.IN_PROGRESS;
            return next;
        }
        if (steps.stream().allMatch(s -> s.getStatus() == ApprovalStepStatus.APPROVED)) {
            boolean limitCovered = steps.stream().anyMatch(s -> s.getApprovalLimit().compareTo(amount) >= 0);
            if (!limitCovered) {
                throw new ApprovalPolicyException("No approving level is authorised for the full amount");
            }
            status = ApprovalStatus.APPROVED;
            decidedAt = now;
            finalComment = comment;
        } else {
            status = ApprovalStatus.IN_PROGRESS;
        }
        return Optional.empty();
    }

    public void reject(ApprovalStep step, UUID actorId, UUID onBehalfOf, String comment, Instant now) {
        assertOpen();
        if (comment == null || comment.isBlank()) {
            throw new InvalidApprovalStateException("A comment is required to reject an approval");
        }
        step.decide(ApprovalStepStatus.REJECTED, actorId, onBehalfOf, comment, now);
        steps.forEach(ApprovalStep::cancel);
        status = ApprovalStatus.REJECTED;
        decidedAt = now;
        finalComment = comment;
    }

    public void cancel(String reason, Instant now) {
        assertOpen();
        steps.forEach(ApprovalStep::cancel);
        status = ApprovalStatus.CANCELLED;
        decidedAt = now;
        finalComment = reason;
    }

    public List<ApprovalStep> pendingSteps() {
        return steps.stream().filter(s -> s.getStatus() == ApprovalStepStatus.PENDING).toList();
    }

    private void assertOpen() {
        if (!status.isOpen()) {
            throw new InvalidApprovalStateException("Approval is already " + status);
        }
    }

    public List<ApprovalStep> getSteps() {
        return Collections.unmodifiableList(steps);
    }
}
