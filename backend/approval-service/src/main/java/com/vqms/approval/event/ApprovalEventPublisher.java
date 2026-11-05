package com.vqms.approval.event;

import com.vqms.approval.config.CorrelationIdFilter;
import com.vqms.approval.config.MessagingProperties;
import com.vqms.approval.constants.ApprovalConstants;
import com.vqms.approval.entity.Approval;
import com.vqms.approval.entity.ApprovalStep;
import com.vqms.approval.enums.ApprovalStepStatus;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.UUID;

/** Writes approval events to the transactional outbox (call inside the business transaction). */
@Component
public class ApprovalEventPublisher {

    public static final String EVENT_STEP_ACTIVATED = "APPROVAL_STEP_ACTIVATED";

    private final OutboxService outboxService;
    private final MessagingProperties properties;

    public ApprovalEventPublisher(OutboxService outboxService, MessagingProperties properties) {
        this.outboxService = outboxService;
        this.properties = properties;
    }

    public void created(Approval a) {
        UUID id = UUID.randomUUID();
        var pending = a.pendingSteps().stream()
                .map(s -> new ApprovalCreatedEvent.PendingLevel(s.getLevelNumber(), s.getRequiredRole(), s.getDueAt()))
                .toList();
        send(id, a, ApprovalConstants.EVENT_APPROVAL_CREATED, new ApprovalCreatedEvent(id,
                ApprovalConstants.EVENT_APPROVAL_CREATED, Instant.now(), CorrelationIdFilter.currentOrNew(), a.getId(),
                a.getApprovalNumber(), a.getRecommendationId(), a.getProcurementRequestId(), a.getQuotationId(),
                a.getVendorId(), a.getAmount(), a.getCurrencyCode(), a.getPolicyCode(), a.getMode().name(), pending));
    }

    public void stepActivated(Approval a, ApprovalStep s) {
        UUID id = UUID.randomUUID();
        send(id, a, EVENT_STEP_ACTIVATED, new ApprovalStepActivatedEvent(id, EVENT_STEP_ACTIVATED, Instant.now(),
                CorrelationIdFilter.currentOrNew(), a.getId(), a.getApprovalNumber(), s.getId(), s.getLevelNumber(),
                s.getRequiredRole(), s.getDueAt()));
    }

    public void completed(Approval a) {
        UUID id = UUID.randomUUID();
        var approvers = a.getSteps().stream().filter(s -> s.getStatus() == ApprovalStepStatus.APPROVED)
                .map(ApprovalStep::getDecidedBy).toList();
        send(id, a, ApprovalConstants.EVENT_APPROVAL_COMPLETED, new ApprovalCompletedEvent(id,
                ApprovalConstants.EVENT_APPROVAL_COMPLETED, Instant.now(), CorrelationIdFilter.currentOrNew(),
                a.getId(), a.getApprovalNumber(), a.getRecommendationId(), a.getProcurementRequestId(),
                a.getQuotationId(), a.getVendorId(), a.getAmount(), a.getCurrencyCode(), a.getDecidedAt(), approvers));
    }

    public void rejected(Approval a, ApprovalStep step, UUID decidedBy, String comment, boolean cancelled) {
        UUID id = UUID.randomUUID();
        send(id, a, ApprovalConstants.EVENT_APPROVAL_REJECTED, new ApprovalRejectedEvent(id,
                ApprovalConstants.EVENT_APPROVAL_REJECTED, Instant.now(), CorrelationIdFilter.currentOrNew(),
                a.getId(), a.getApprovalNumber(), a.getRecommendationId(), a.getProcurementRequestId(),
                a.getQuotationId(), step == null ? null : step.getLevelNumber(), decidedBy, comment, cancelled));
    }

    public void escalated(Approval a, ApprovalStep s, boolean automatic) {
        UUID id = UUID.randomUUID();
        send(id, a, ApprovalConstants.EVENT_APPROVAL_ESCALATED, new ApprovalEscalatedEvent(id,
                ApprovalConstants.EVENT_APPROVAL_ESCALATED, Instant.now(), CorrelationIdFilter.currentOrNew(),
                a.getId(), a.getApprovalNumber(), s.getId(), s.getLevelNumber(), s.getRequiredRole(),
                s.getEscalationRole(), s.getDueAt(), automatic));
    }

    private void send(UUID eventId, Approval a, String type, Object payload) {
        outboxService.enqueue(eventId, ApprovalConstants.AGGREGATE_TYPE, a.getId(), type,
                properties.approvalEventsTopic(), payload);
    }
}
