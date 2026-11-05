package com.vqms.approval.repository;

import com.vqms.approval.entity.ApprovalStep;
import com.vqms.approval.enums.ApprovalStepStatus;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface ApprovalStepRepository extends JpaRepository<ApprovalStep, UUID> {

    /** Overdue, not yet escalated steps (escalation job). */
    List<ApprovalStep> findByStatusAndEscalatedFalseAndDueAtBefore(ApprovalStepStatus status, Instant now, Limit limit);
}
