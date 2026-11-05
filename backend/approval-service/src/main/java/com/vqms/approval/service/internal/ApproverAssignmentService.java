package com.vqms.approval.service.internal;

import com.vqms.approval.dto.internal.ApprovalWorkflowResult;
import com.vqms.approval.entity.Approval;
import com.vqms.approval.entity.ApprovalDelegation;
import com.vqms.approval.entity.ApprovalStep;
import com.vqms.approval.enums.ApprovalStepStatus;
import com.vqms.approval.exception.UnauthorizedApproverException;
import com.vqms.approval.security.AuthenticatedUser;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/**
 * Decides who may act on which pending level. Authority comes from (in order):
 * the level's required role, an escalation of the level to the user's role, or an effective
 * delegation from a user holding the required role.
 *
 * <p>Controls (applied to the actor AND, for delegations, to the delegator):</p>
 * <ul>
 *   <li>no self-approval: the recommendation submitter and the procurement requester can never decide;</li>
 *   <li>segregation of duties: one person decides at most one level of an approval;</li>
 *   <li>administrators get no implicit approval authority - only through the policy roles.</li>
 * </ul>
 */
@Service
public class ApproverAssignmentService {

    private final DelegationService delegationService;

    public ApproverAssignmentService(DelegationService delegationService) {
        this.delegationService = delegationService;
    }

    public ApprovalWorkflowResult resolve(Approval approval, AuthenticatedUser user, Instant now) {
        List<ApprovalDelegation> delegations = delegationService.effectiveFor(user.userId(), now);
        for (ApprovalStep step : approval.pendingSteps()) {
            Optional<ApprovalWorkflowResult> authority = authorityFor(step, user, delegations);
            if (authority.isPresent()) {
                assertSegregation(approval, authority.get());
                return authority.get();
            }
        }
        throw new UnauthorizedApproverException("You are not an approver for any pending level of this approval");
    }

    /** True when the user can currently act (used for the "my pending approvals" inbox). */
    public boolean canAct(Approval approval, AuthenticatedUser user, Instant now) {
        try {
            resolve(approval, user, now);
            return true;
        } catch (UnauthorizedApproverException ex) {
            return false;
        }
    }

    private static Optional<ApprovalWorkflowResult> authorityFor(ApprovalStep step, AuthenticatedUser user,
                                                                 List<ApprovalDelegation> delegations) {
        if (step.getRequiredRole().equals(user.role())) {
            return Optional.of(new ApprovalWorkflowResult(step, user.userId(), null, "ROLE"));
        }
        if (step.isEscalated() && Objects.equals(step.getEscalationRole(), user.role())) {
            return Optional.of(new ApprovalWorkflowResult(step, user.userId(), null, "ESCALATION"));
        }
        return delegations.stream()
                .filter(d -> d.getDelegatorRole().equals(step.getRequiredRole()))
                .findFirst()
                .map(d -> new ApprovalWorkflowResult(step, user.userId(), d.getDelegatorId(), "DELEGATION"));
    }

    private static void assertSegregation(Approval approval, ApprovalWorkflowResult authority) {
        UUID actor = authority.actorId();
        UUID principal = authority.onBehalfOf();
        for (UUID person : principal == null ? List.of(actor) : List.of(actor, principal)) {
            if (person.equals(approval.getSubmittedBy())) {
                throw new UnauthorizedApproverException("Self-approval is not allowed: you submitted this recommendation");
            }
            if (person.equals(approval.getRequesterId())) {
                throw new UnauthorizedApproverException("Self-approval is not allowed: you raised this procurement request");
            }
            boolean decidedAnotherLevel = approval.getSteps().stream()
                    .filter(s -> s.getStatus() == ApprovalStepStatus.APPROVED)
                    .anyMatch(s -> person.equals(s.getDecidedBy()) || person.equals(s.accountableUser()));
            if (decidedAnotherLevel) {
                throw new UnauthorizedApproverException("The same person cannot decide more than one approval level");
            }
        }
    }
}
