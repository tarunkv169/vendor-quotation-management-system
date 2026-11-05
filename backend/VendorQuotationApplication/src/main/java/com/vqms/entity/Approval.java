package com.vqms.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "approvals", indexes = {
        @Index(name = "idx_approval_request", columnList = "purchase_request_id"),
        @Index(name = "idx_approval_status", columnList = "status"),
        @Index(name = "idx_approval_approver", columnList = "approver_id"),
        @Index(name = "idx_approval_level", columnList = "approval_level")
})
@Getter
@Setter
@NoArgsConstructor
public class Approval {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "purchase_request_id", nullable = false)
    private UUID purchaseRequestId;

    @Column(name = "quotation_id")
    private UUID quotationId;

    @Column(name = "approver_id", nullable = false)
    private UUID approverId;

    @Column(name = "approval_level", nullable = false)
    private Integer approvalLevel;

    @Column(name = "approval_role", nullable = false, length = 50)
    private String approvalRole;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ApprovalStatus status = ApprovalStatus.PENDING;

    @Column(name = "decision_comment", columnDefinition = "TEXT")
    private String decisionComment;

    @Column(name = "decision_at")
    private LocalDateTime decisionAt;

    @Column(name = "amount", precision = 15, scale = 2)
    private BigDecimal amount;

    @Column(name = "delegated_to")
    private UUID delegatedTo;

    @Column(name = "delegated_at")
    private LocalDateTime delegatedAt;

    @Column(name = "due_date")
    private LocalDateTime dueDate;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
