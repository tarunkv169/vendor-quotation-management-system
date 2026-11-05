package com.vqms.approval.controller;

import com.vqms.approval.constants.ApprovalConstants;
import com.vqms.approval.dto.request.ApprovalDecisionRequest;
import com.vqms.approval.dto.request.ApprovalDelegationRequest;
import com.vqms.approval.dto.request.ApprovalRequest;
import com.vqms.approval.dto.response.ApprovalHistoryResponse;
import com.vqms.approval.dto.response.ApprovalResponse;
import com.vqms.approval.dto.response.DelegationResponse;
import com.vqms.approval.dto.response.PageResponse;
import com.vqms.approval.enums.ApprovalStatus;
import com.vqms.approval.mapper.ApprovalMapper;
import com.vqms.approval.security.CurrentUserProvider;
import com.vqms.approval.service.ApprovalService;
import com.vqms.approval.service.internal.DelegationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Approval endpoints (internal staff only). Approve/reject are open to any staff role at this gate;
 * the service decides whether the caller actually holds authority for a pending level.
 */
@RestController
@RequestMapping(ApprovalConstants.API_BASE_PATH)
@PreAuthorize("hasAnyRole('ADMIN','PROCUREMENT_ADMIN','PROCUREMENT_MANAGER','EMPLOYEE','INTERNAL_SERVICE')")
@Tag(name = "Approvals")
public class ApprovalController {

    private final ApprovalService approvalService;
    private final DelegationService delegationService;
    private final CurrentUserProvider currentUserProvider;
    private final ApprovalMapper mapper;

    public ApprovalController(ApprovalService approvalService, DelegationService delegationService,
                              CurrentUserProvider currentUserProvider, ApprovalMapper mapper) {
        this.approvalService = approvalService;
        this.delegationService = delegationService;
        this.currentUserProvider = currentUserProvider;
        this.mapper = mapper;
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','PROCUREMENT_ADMIN','INTERNAL_SERVICE')")
    @Operation(summary = "Open an approval for a recommendation submitted for approval")
    public ResponseEntity<ApprovalResponse> create(@Valid @RequestBody ApprovalRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(approvalService.create(request));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get an approval with its levels")
    public ResponseEntity<ApprovalResponse> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(approvalService.getById(id));
    }

    @GetMapping
    @Operation(summary = "Search approvals")
    public ResponseEntity<PageResponse<ApprovalResponse>> search(
            @RequestParam(required = false) ApprovalStatus status,
            @RequestParam(required = false) UUID procurementRequestId,
            @ParameterObject @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(approvalService.search(status, procurementRequestId, pageable));
    }

    @GetMapping("/pending")
    @Operation(summary = "Approvals awaiting the current user's decision")
    public ResponseEntity<List<ApprovalResponse>> pending() {
        return ResponseEntity.ok(approvalService.pendingForCurrentUser());
    }

    @PostMapping("/{id}/approve")
    @Operation(summary = "Approve the pending level the caller is authorised for")
    public ResponseEntity<ApprovalResponse> approve(@PathVariable UUID id,
                                                    @Valid @RequestBody(required = false) ApprovalDecisionRequest request) {
        return ResponseEntity.ok(approvalService.approve(id, request));
    }

    @PostMapping("/{id}/reject")
    @Operation(summary = "Reject (comment required)")
    public ResponseEntity<ApprovalResponse> reject(@PathVariable UUID id,
                                                   @Valid @RequestBody ApprovalDecisionRequest request) {
        return ResponseEntity.ok(approvalService.reject(id, request));
    }

    @PostMapping("/{id}/escalate")
    @PreAuthorize("hasAnyRole('ADMIN','PROCUREMENT_ADMIN')")
    @Operation(summary = "Escalate pending levels manually")
    public ResponseEntity<ApprovalResponse> escalate(@PathVariable UUID id,
                                                     @Valid @RequestBody(required = false) ApprovalDecisionRequest request) {
        return ResponseEntity.ok(approvalService.escalate(id, request));
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAnyRole('ADMIN','PROCUREMENT_ADMIN')")
    @Operation(summary = "Cancel an open approval (reason required)")
    public ResponseEntity<ApprovalResponse> cancel(@PathVariable UUID id,
                                                   @Valid @RequestBody ApprovalDecisionRequest request) {
        return ResponseEntity.ok(approvalService.cancel(id, request));
    }

    @GetMapping("/{id}/history")
    @Operation(summary = "Audit trail of an approval")
    public ResponseEntity<List<ApprovalHistoryResponse>> history(@PathVariable UUID id) {
        return ResponseEntity.ok(approvalService.history(id));
    }

    // ------------------------------------------------------------------ delegations

    @PostMapping("/delegations")
    @PreAuthorize("hasAnyRole('ADMIN','PROCUREMENT_ADMIN','PROCUREMENT_MANAGER','EMPLOYEE')")
    @Operation(summary = "Delegate your approval authority for a period")
    public ResponseEntity<DelegationResponse> delegate(@Valid @RequestBody ApprovalDelegationRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(mapper.toDelegationResponse(
                delegationService.create(currentUserProvider.getCurrentUser(), request)));
    }

    @GetMapping("/delegations/my")
    @Operation(summary = "Delegations given or received by the current user")
    public ResponseEntity<List<DelegationResponse>> myDelegations() {
        return ResponseEntity.ok(delegationService.mine(currentUserProvider.getCurrentUser().userId()).stream()
                .map(mapper::toDelegationResponse).toList());
    }

    @DeleteMapping("/delegations/{delegationId}")
    @Operation(summary = "Revoke a delegation")
    public ResponseEntity<DelegationResponse> revoke(@PathVariable UUID delegationId) {
        return ResponseEntity.ok(mapper.toDelegationResponse(
                delegationService.revoke(currentUserProvider.getCurrentUser(), delegationId)));
    }
}
