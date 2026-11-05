package com.vqms.controller;

import com.vqms.dto.request.ApprovalDecisionRequest;
import com.vqms.dto.request.ApprovalRequest;
import com.vqms.dto.response.ApprovalResponse;
import com.vqms.service.ApprovalService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/approvals")
@RequiredArgsConstructor
public class ApprovalController {

    private final ApprovalService approvalService;

    // ==================================================
    // APPROVAL CRUD
    // ==================================================

    @PostMapping
    public ResponseEntity<ApprovalResponse> createApproval(
            @Valid @RequestBody ApprovalRequest request) {
        ApprovalResponse response = approvalService.createApproval(request, UUID.randomUUID());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApprovalResponse> getApproval(@PathVariable UUID id) {
        return ResponseEntity.ok(approvalService.getApprovalById(id));
    }

    @GetMapping("/request/{requestId}")
    public ResponseEntity<Page<ApprovalResponse>> getApprovalsByRequest(
            @PathVariable UUID requestId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("approvalLevel").ascending());
        return ResponseEntity.ok(approvalService.getApprovalsByRequestId(requestId, pageable));
    }

    @GetMapping("/approver/{approverId}")
    public ResponseEntity<Page<ApprovalResponse>> getApprovalsByApprover(
            @PathVariable UUID approverId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ResponseEntity.ok(approvalService.getApprovalsByApproverId(approverId, pageable));
    }

    // ==================================================
    // APPROVAL DECISIONS
    // ==================================================

    @PostMapping("/{id}/decision")
    public ResponseEntity<ApprovalResponse> makeDecision(
            @PathVariable UUID id,
            @Valid @RequestBody ApprovalDecisionRequest request) {
        return ResponseEntity.ok(approvalService.makeDecision(id, request, UUID.randomUUID()));
    }

    // ==================================================
    // APPROVAL WORKFLOW
    // ==================================================

    @GetMapping("/pending/{approverId}")
    public ResponseEntity<Page<ApprovalResponse>> getPendingApprovals(
            @PathVariable UUID approverId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").ascending());
        return ResponseEntity.ok(approvalService.getPendingApprovals(approverId, pageable));
    }

    @GetMapping("/overdue/{approverId}")
    public ResponseEntity<Page<ApprovalResponse>> getOverdueApprovals(
            @PathVariable UUID approverId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("dueDate").ascending());
        return ResponseEntity.ok(approvalService.getOverdueApprovals(approverId, pageable));
    }

    @GetMapping("/request/{requestId}/history")
    public ResponseEntity<List<ApprovalResponse>> getApprovalHistory(@PathVariable UUID requestId) {
        return ResponseEntity.ok(approvalService.getApprovalHistory(requestId));
    }

    @GetMapping("/quotation/{quotationId}/history")
    public ResponseEntity<List<ApprovalResponse>> getQuotationApprovalHistory(@PathVariable UUID quotationId) {
        return ResponseEntity.ok(approvalService.getQuotationApprovalHistory(quotationId));
    }

    @GetMapping("/request/{requestId}/current")
    public ResponseEntity<ApprovalResponse> getCurrentPendingApproval(@PathVariable UUID requestId) {
        return ResponseEntity.ok(approvalService.getCurrentPendingApproval(requestId));
    }

    @GetMapping("/request/{requestId}/fully-approved")
    public ResponseEntity<Boolean> isFullyApproved(@PathVariable UUID requestId) {
        return ResponseEntity.ok(approvalService.isFullyApproved(requestId));
    }

    @PostMapping("/{id}/delegate")
    public ResponseEntity<ApprovalResponse> delegateApproval(
            @PathVariable UUID id,
            @RequestParam UUID delegatedTo) {
        return ResponseEntity.ok(approvalService.delegateApproval(id, delegatedTo, UUID.randomUUID()));
    }
}
