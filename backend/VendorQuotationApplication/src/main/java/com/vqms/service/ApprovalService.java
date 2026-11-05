package com.vqms.service;

import com.vqms.dto.request.ApprovalDecisionRequest;
import com.vqms.dto.request.ApprovalRequest;
import com.vqms.dto.response.ApprovalResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.UUID;

public interface ApprovalService {

    ApprovalResponse createApproval(UUID requestId, UUID approverId);

    ApprovalResponse createApproval(ApprovalRequest request, UUID userId);

    ApprovalResponse getApprovalById(UUID id);

    Page<ApprovalResponse> getApprovalsByRequestId(UUID requestId, Pageable pageable);

    Page<ApprovalResponse> getApprovalsByApproverId(UUID approverId, Pageable pageable);

    ApprovalResponse makeDecision(UUID approvalId, ApprovalDecisionRequest request, UUID userId);

    Page<ApprovalResponse> getPendingApprovals(UUID approverId, Pageable pageable);

    // Get approval history for a purchase request, ordered by level
    List<ApprovalResponse> getApprovalHistory(UUID requestId);

    // Get approval history for a quotation
    List<ApprovalResponse> getQuotationApprovalHistory(UUID quotationId);

    // Delegate an approval to another user
    ApprovalResponse delegateApproval(UUID approvalId, UUID delegatedTo, UUID userId);

    // Get the current pending approval level for a request
    ApprovalResponse getCurrentPendingApproval(UUID requestId);

    // Check if all approval levels are completed for a request
    boolean isFullyApproved(UUID requestId);

    // Get overdue approvals for an approver
    Page<ApprovalResponse> getOverdueApprovals(UUID approverId, Pageable pageable);
}
