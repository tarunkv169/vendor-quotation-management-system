package com.vqms.approval.mapper;

import com.vqms.approval.dto.response.ApprovalHistoryResponse;
import com.vqms.approval.dto.response.ApprovalPolicyResponse;
import com.vqms.approval.dto.response.ApprovalResponse;
import com.vqms.approval.dto.response.ApprovalStepResponse;
import com.vqms.approval.dto.response.DelegationResponse;
import com.vqms.approval.entity.Approval;
import com.vqms.approval.entity.ApprovalDelegation;
import com.vqms.approval.entity.ApprovalHistory;
import com.vqms.approval.entity.ApprovalPolicy;
import com.vqms.approval.entity.ApprovalStep;
import org.springframework.stereotype.Component;

import java.time.Instant;

@Component
public class ApprovalMapper {

    public ApprovalResponse toResponse(Approval a, boolean includeSteps) {
        Instant now = Instant.now();
        return new ApprovalResponse(a.getId(), a.getApprovalNumber(), a.getRecommendationId(),
                a.getRecommendationNumber(), a.getProcurementRequestId(), a.getQuotationId(), a.getVendorId(),
                a.getAmount(), a.getCurrencyCode(), a.getStatus(), a.getMode(), a.getPolicyCode(), a.getRiskLevel(),
                a.isRequiresReview(), a.getReviewReasons(), a.getSubmittedBy(), a.getDecidedAt(), a.getFinalComment(),
                a.getCreatedAt(), a.getVersion(),
                includeSteps ? a.getSteps().stream().map(s -> toStepResponse(s, now)).toList() : null);
    }

    public ApprovalStepResponse toStepResponse(ApprovalStep s, Instant now) {
        return new ApprovalStepResponse(s.getId(), s.getLevelNumber(), s.getLevel(), s.getRequiredRole(),
                s.getApprovalLimit(), s.getStatus(), s.getActivatedAt(), s.getDueAt(), s.isOverdue(now),
                s.isEscalated(), s.getEscalationRole(), s.getDecidedBy(), s.getOnBehalfOf(), s.getDecidedAt(),
                s.getDecisionComment());
    }

    public ApprovalHistoryResponse toHistoryResponse(ApprovalHistory h) {
        return new ApprovalHistoryResponse(h.getId(), h.getStepId(), h.getAction(), h.getActorId(), h.getOnBehalfOf(),
                h.getComment(), h.getCreatedAt());
    }

    public ApprovalPolicyResponse toPolicyResponse(ApprovalPolicy p) {
        return new ApprovalPolicyResponse(p.getId(), p.getCode(), p.getName(), p.getDescription(), p.getCurrencyCode(),
                p.getMinAmount(), p.getMaxAmount(), p.getMode(), p.getLevels(), p.getEscalationRole(),
                p.getEscalationHours(), p.getPriority(), p.isActive(), p.getVersion());
    }

    public DelegationResponse toDelegationResponse(ApprovalDelegation d) {
        return new DelegationResponse(d.getId(), d.getDelegatorId(), d.getDelegatorRole(), d.getDelegateId(),
                d.getValidFrom(), d.getValidUntil(), d.getReason(), d.isActive(), d.isEffective(Instant.now()));
    }
}
