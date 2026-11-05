package com.vqms.approval.service;

import com.vqms.approval.dto.request.ApprovalDecisionRequest;
import com.vqms.approval.dto.request.ApprovalRequest;
import com.vqms.approval.dto.response.ApprovalHistoryResponse;
import com.vqms.approval.dto.response.ApprovalResponse;
import com.vqms.approval.dto.response.PageResponse;
import com.vqms.approval.enums.ApprovalStatus;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.UUID;

/** Approval use cases. */
public interface ApprovalService {

    ApprovalResponse create(ApprovalRequest request);

    ApprovalResponse approve(UUID approvalId, ApprovalDecisionRequest request);

    ApprovalResponse reject(UUID approvalId, ApprovalDecisionRequest request);

    ApprovalResponse escalate(UUID approvalId, ApprovalDecisionRequest request);

    ApprovalResponse cancel(UUID approvalId, ApprovalDecisionRequest request);

    ApprovalResponse getById(UUID approvalId);

    PageResponse<ApprovalResponse> search(ApprovalStatus status, UUID procurementRequestId, Pageable pageable);

    List<ApprovalResponse> pendingForCurrentUser();

    List<ApprovalHistoryResponse> history(UUID approvalId);
}
