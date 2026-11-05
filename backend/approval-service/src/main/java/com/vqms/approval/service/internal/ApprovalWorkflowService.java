package com.vqms.approval.service.internal;

import com.vqms.approval.dto.internal.ApprovalWorkflowResult;
import com.vqms.approval.entity.Approval;
import com.vqms.approval.entity.ApprovalHistory;
import com.vqms.approval.entity.ApprovalPolicy;
import com.vqms.approval.entity.ApprovalStep;
import com.vqms.approval.enums.ApprovalAction;
import com.vqms.approval.enums.ApprovalStatus;
import com.vqms.approval.event.ApprovalEventPublisher;
import com.vqms.approval.repository.ApprovalHistoryRepository;
import com.vqms.approval.repository.ApprovalPolicyRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Applies state changes to an approval together with its audit trail and outbox events.
 * {@code Propagation.MANDATORY}: always runs inside the caller's transaction, so the state change,
 * history row and event are committed atomically.
 */
@Service
@Transactional(propagation = Propagation.MANDATORY)
public class ApprovalWorkflowService {

    private final ApprovalHistoryRepository historyRepository;
    private final ApprovalPolicyRepository policyRepository;
    private final ApprovalEventPublisher eventPublisher;

    public ApprovalWorkflowService(ApprovalHistoryRepository historyRepository,
                                   ApprovalPolicyRepository policyRepository, ApprovalEventPublisher eventPublisher) {
        this.historyRepository = historyRepository;
        this.policyRepository = policyRepository;
        this.eventPublisher = eventPublisher;
    }

    public void start(Approval approval, UUID actorId, Instant now) {
        List<ApprovalStep> activated = approval.start(now);
        record(approval, null, ApprovalAction.CREATED, actorId, null, "Approval created with policy "
                + approval.getPolicyCode());
        activated.forEach(step -> record(approval, step, ApprovalAction.STEP_ACTIVATED, null, null,
                "Level " + step.getLevelNumber() + " awaiting " + step.getRequiredRole()));
        eventPublisher.created(approval);
    }

    public void approve(Approval approval, ApprovalWorkflowResult authority, String comment, Instant now) {
        Optional<ApprovalStep> next = approval.approve(authority.step(), authority.actorId(), authority.onBehalfOf(),
                comment, now);
        record(approval, authority.step(), ApprovalAction.APPROVED, authority.actorId(), authority.onBehalfOf(),
                comment);
        next.ifPresent(step -> {
            record(approval, step, ApprovalAction.STEP_ACTIVATED, null, null,
                    "Level " + step.getLevelNumber() + " awaiting " + step.getRequiredRole());
            eventPublisher.stepActivated(approval, step);
        });
        if (approval.getStatus() == ApprovalStatus.APPROVED) {
            record(approval, null, ApprovalAction.COMPLETED, authority.actorId(), null, "All levels approved");
            eventPublisher.completed(approval);
        }
    }

    public void reject(Approval approval, ApprovalWorkflowResult authority, String comment, Instant now) {
        approval.reject(authority.step(), authority.actorId(), authority.onBehalfOf(), comment, now);
        record(approval, authority.step(), ApprovalAction.REJECTED, authority.actorId(), authority.onBehalfOf(),
                comment);
        eventPublisher.rejected(approval, authority.step(), authority.actorId(), comment, false);
    }

    public void cancel(Approval approval, UUID actorId, String reason, Instant now) {
        approval.cancel(reason, now);
        record(approval, null, ApprovalAction.CANCELLED, actorId, null, reason);
        eventPublisher.rejected(approval, null, actorId, reason, true);
    }

    /** Escalates a pending level to the policy's escalation role and extends its deadline. */
    public void escalate(Approval approval, ApprovalStep step, UUID actorId, String comment, Instant now) {
        ApprovalPolicy policy = policyRepository.findById(approval.getPolicyId()).orElse(null);
        String role = policy != null ? policy.getEscalationRole() : "ADMIN";
        int hours = policy != null ? policy.getEscalationHours() : 24;
        step.escalate(role, hours, now);
        record(approval, step, ApprovalAction.ESCALATED, actorId, null,
                (actorId == null ? "Deadline missed; " : "") + "escalated to " + role
                        + (comment == null ? "" : ": " + comment));
        eventPublisher.escalated(approval, step, actorId == null);
    }

    private void record(Approval approval, ApprovalStep step, ApprovalAction action, UUID actorId, UUID onBehalfOf,
                        String comment) {
        historyRepository.save(new ApprovalHistory(approval.getId(), step == null ? null : step.getId(), action,
                actorId, onBehalfOf, comment));
    }
}
