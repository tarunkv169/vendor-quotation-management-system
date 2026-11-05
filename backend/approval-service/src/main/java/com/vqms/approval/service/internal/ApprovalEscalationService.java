package com.vqms.approval.service.internal;

import com.vqms.approval.entity.ApprovalStep;
import com.vqms.approval.enums.ApprovalStepStatus;
import com.vqms.approval.repository.ApprovalStepRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Limit;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

/**
 * Deadline tracking: periodically escalates pending levels whose deadline has passed.
 * Each level is escalated once (the escalation role can then decide it; the new deadline is tracked
 * and visible as "overdue" again if missed). Concurrent instances are safe thanks to optimistic locking.
 */
@Service
public class ApprovalEscalationService {

    private static final Logger log = LoggerFactory.getLogger(ApprovalEscalationService.class);

    private final ApprovalStepRepository stepRepository;
    private final ApprovalWorkflowService workflowService;

    public ApprovalEscalationService(ApprovalStepRepository stepRepository, ApprovalWorkflowService workflowService) {
        this.stepRepository = stepRepository;
        this.workflowService = workflowService;
    }

    @Scheduled(fixedDelayString = "${vqms.approval.escalation-check-interval:PT5M}", initialDelayString = "PT1M")
    @Transactional
    public void escalateOverdueSteps() {
        Instant now = Instant.now();
        List<ApprovalStep> overdue = stepRepository.findByStatusAndEscalatedFalseAndDueAtBefore(
                ApprovalStepStatus.PENDING, now, Limit.of(100));
        for (ApprovalStep step : overdue) {
            workflowService.escalate(step.getApproval(), step, null, null, now);
        }
        if (!overdue.isEmpty()) {
            log.warn("Escalated {} overdue approval level(s)", overdue.size());
        }
    }
}
