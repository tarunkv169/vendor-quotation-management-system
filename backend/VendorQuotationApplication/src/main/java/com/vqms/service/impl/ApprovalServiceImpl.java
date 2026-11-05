package com.vqms.service.impl;

import com.vqms.dto.request.ApprovalDecisionRequest;
import com.vqms.dto.request.ApprovalRequest;
import com.vqms.dto.response.ApprovalResponse;
import com.vqms.entity.Approval;
import com.vqms.entity.ApprovalStatus;
import com.vqms.entity.User;
import com.vqms.exception.BadRequestException;
import com.vqms.repository.ApprovalRepository;
import com.vqms.repository.UserRepository;
import com.vqms.service.ApprovalService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class ApprovalServiceImpl implements ApprovalService {

    private final ApprovalRepository approvalRepository;
    private final UserRepository userRepository;

    @Override
    public ApprovalResponse createApproval(UUID requestId, UUID approverId) {
        // Legacy method: create level 1 approval
        Approval approval = new Approval();
        approval.setPurchaseRequestId(requestId);
        approval.setApproverId(approverId);
        approval.setApprovalLevel(1);
        approval.setApprovalRole("PROCUREMENT_MANAGER");
        approval.setStatus(ApprovalStatus.PENDING);
        Approval saved = approvalRepository.save(approval);
        return toResponse(saved);
    }

    @Override
    public ApprovalResponse createApproval(ApprovalRequest request, UUID userId) {
        // Check for duplicate level
        if (approvalRepository.existsByPurchaseRequestIdAndApprovalLevel(
                request.getPurchaseRequestId(), request.getApprovalLevel())) {
            throw new BadRequestException(
                    "Approval level " + request.getApprovalLevel() + " already exists for this request");
        }

        // Validate approver exists
        userRepository.findById(request.getApproverId())
                .orElseThrow(() -> new EntityNotFoundException("Approver not found"));

        Approval approval = new Approval();
        approval.setPurchaseRequestId(request.getPurchaseRequestId());
        approval.setQuotationId(request.getQuotationId());
        approval.setApproverId(request.getApproverId());
        approval.setApprovalLevel(request.getApprovalLevel());
        approval.setApprovalRole(request.getApprovalRole().toUpperCase());
        approval.setStatus(ApprovalStatus.PENDING);
        approval.setAmount(request.getAmount());
        approval.setCreatedBy(userId);
        if (request.getDelegatedTo() != null) {
            approval.setDelegatedTo(request.getDelegatedTo());
            approval.setDelegatedAt(LocalDateTime.now());
        }

        Approval saved = approvalRepository.save(approval);
        return toResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public ApprovalResponse getApprovalById(UUID id) {
        Approval approval = approvalRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Approval not found"));
        return toResponse(approval);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<ApprovalResponse> getApprovalsByRequestId(UUID requestId, Pageable pageable) {
        return approvalRepository.findByPurchaseRequestId(requestId, pageable).map(this::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<ApprovalResponse> getApprovalsByApproverId(UUID approverId, Pageable pageable) {
        return approvalRepository.findByApproverId(approverId, pageable).map(this::toResponse);
    }

    @Override
    public ApprovalResponse makeDecision(UUID approvalId, ApprovalDecisionRequest request, UUID userId) {
        Approval approval = approvalRepository.findById(approvalId)
                .orElseThrow(() -> new EntityNotFoundException("Approval not found"));

        if (approval.getStatus() != ApprovalStatus.PENDING) {
            throw new BadRequestException("Approval already decided with status: " + approval.getStatus());
        }

        String decision = request.getDecision();
        if (decision == null || decision.isBlank()) {
            throw new BadRequestException("Decision is required");
        }

        switch (decision.toUpperCase().trim()) {
            case "APPROVED":
                approval.setStatus(ApprovalStatus.APPROVED);
                break;
            case "REJECTED":
                approval.setStatus(ApprovalStatus.REJECTED);
                break;
            case "CLARIFICATION_REQUESTED":
                approval.setStatus(ApprovalStatus.CLARIFICATION_REQUESTED);
                break;
            default:
                throw new BadRequestException("Invalid decision: " + decision);
        }

        approval.setDecisionComment(request.getComment());
        approval.setDecisionAt(LocalDateTime.now());
        Approval saved = approvalRepository.save(approval);
        return toResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<ApprovalResponse> getPendingApprovals(UUID approverId, Pageable pageable) {
        return approvalRepository.findByApproverIdAndStatus(approverId, ApprovalStatus.PENDING, pageable)
                .map(this::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ApprovalResponse> getApprovalHistory(UUID requestId) {
        return approvalRepository.findByPurchaseRequestIdOrderByApprovalLevelAsc(requestId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<ApprovalResponse> getQuotationApprovalHistory(UUID quotationId) {
        return approvalRepository.findByQuotationIdOrderByApprovalLevelAsc(quotationId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    public ApprovalResponse delegateApproval(UUID approvalId, UUID delegatedTo, UUID userId) {
        Approval approval = approvalRepository.findById(approvalId)
                .orElseThrow(() -> new EntityNotFoundException("Approval not found"));

        if (approval.getStatus() != ApprovalStatus.PENDING) {
            throw new BadRequestException("Can only delegate pending approvals");
        }

        // Validate delegatee exists
        userRepository.findById(delegatedTo)
                .orElseThrow(() -> new EntityNotFoundException("Delegatee not found"));

        approval.setApproverId(delegatedTo);
        approval.setDelegatedTo(delegatedTo);
        approval.setDelegatedAt(LocalDateTime.now());

        Approval saved = approvalRepository.save(approval);
        return toResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public ApprovalResponse getCurrentPendingApproval(UUID requestId) {
        List<Approval> approvals = approvalRepository.findByPurchaseRequestIdOrderByApprovalLevelAsc(requestId);

        for (Approval approval : approvals) {
            if (approval.getStatus() == ApprovalStatus.PENDING) {
                return toResponse(approval);
            }
        }
        throw new BadRequestException("No pending approval found for this request");
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isFullyApproved(UUID requestId) {
        List<Approval> approvals = approvalRepository.findByPurchaseRequestIdOrderByApprovalLevelAsc(requestId);

        for (Approval approval : approvals) {
            if (approval.getStatus() == ApprovalStatus.PENDING
                    || approval.getStatus() == ApprovalStatus.CLARIFICATION_REQUESTED) {
                return false;
            }
            if (approval.getStatus() == ApprovalStatus.REJECTED) {
                return false;
            }
        }
        return !approvals.isEmpty();
    }

    @Override
    @Transactional(readOnly = true)
    public Page<ApprovalResponse> getOverdueApprovals(UUID approverId, Pageable pageable) {
        return approvalRepository.findOverdueApprovals(
                approverId, ApprovalStatus.PENDING, LocalDateTime.now(), pageable)
                .map(this::toResponse);
    }

    private ApprovalResponse toResponse(Approval approval) {
        ApprovalResponse response = new ApprovalResponse();
        response.setId(approval.getId());
        response.setPurchaseRequestId(approval.getPurchaseRequestId());
        response.setQuotationId(approval.getQuotationId());
        response.setApproverId(approval.getApproverId());
        response.setApprovalLevel(approval.getApprovalLevel());
        response.setApprovalRole(approval.getApprovalRole());
        response.setStatus(approval.getStatus());
        response.setDecisionComment(approval.getDecisionComment());
        response.setDecisionAt(approval.getDecisionAt());
        response.setAmount(approval.getAmount());
        response.setDelegatedTo(approval.getDelegatedTo());
        response.setDelegatedAt(approval.getDelegatedAt());
        response.setDueDate(approval.getDueDate());
        response.setCreatedBy(approval.getCreatedBy());
        response.setCreatedAt(approval.getCreatedAt());
        response.setUpdatedAt(approval.getUpdatedAt());

        // Load approver name
        User user = userRepository.findById(approval.getApproverId()).orElse(null);
        if (user != null) {
            response.setApproverName(user.getFullName());
        }

        return response;
    }
}
