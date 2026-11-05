package com.vqms.approval.controller;

import com.vqms.approval.constants.ApprovalConstants;
import com.vqms.approval.dto.request.ApprovalPolicyRequest;
import com.vqms.approval.dto.response.ApprovalPolicyResponse;
import com.vqms.approval.service.ApprovalPolicyService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** Approval policy administration (write: ADMIN only; read: procurement staff). */
@RestController
@RequestMapping(ApprovalConstants.POLICY_API_BASE_PATH)
@PreAuthorize("hasAnyRole('ADMIN','PROCUREMENT_ADMIN','PROCUREMENT_MANAGER')")
@Tag(name = "Approval policies")
public class ApprovalPolicyController {

    private final ApprovalPolicyService policyService;

    public ApprovalPolicyController(ApprovalPolicyService policyService) {
        this.policyService = policyService;
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Create an approval policy")
    public ResponseEntity<ApprovalPolicyResponse> create(@Valid @RequestBody ApprovalPolicyRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(policyService.create(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Update an approval policy (applies to new approvals only)")
    public ResponseEntity<ApprovalPolicyResponse> update(@PathVariable UUID id,
                                                         @Valid @RequestBody ApprovalPolicyRequest request) {
        return ResponseEntity.ok(policyService.update(id, request));
    }

    @PatchMapping("/{id}/deactivate")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Deactivate an approval policy")
    public ResponseEntity<ApprovalPolicyResponse> deactivate(@PathVariable UUID id) {
        return ResponseEntity.ok(policyService.deactivate(id));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get an approval policy")
    public ResponseEntity<ApprovalPolicyResponse> get(@PathVariable UUID id) {
        return ResponseEntity.ok(policyService.get(id));
    }

    @GetMapping
    @Operation(summary = "List approval policies")
    public ResponseEntity<List<ApprovalPolicyResponse>> list() {
        return ResponseEntity.ok(policyService.list());
    }
}
