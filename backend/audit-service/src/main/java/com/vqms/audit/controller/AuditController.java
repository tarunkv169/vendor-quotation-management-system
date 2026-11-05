package com.vqms.audit.controller;

import com.vqms.audit.constants.AuditConstants;
import com.vqms.audit.dto.request.AuditEventRequest;
import com.vqms.audit.dto.response.AuditEventResponse;
import com.vqms.audit.dto.response.ChainVerificationResponse;
import com.vqms.audit.dto.response.PageResponse;
import com.vqms.audit.service.AuditService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Audit trail API: write (internal services, administrators) and read (auditors). No update/delete exists. */
@RestController
@RequestMapping(AuditConstants.API_BASE_PATH)
@Tag(name = "Audit")
public class AuditController {

    private final AuditService auditService;

    public AuditController(AuditService auditService) {
        this.auditService = auditService;
    }

    @PostMapping("/events")
    @PreAuthorize("hasAnyRole('INTERNAL_SERVICE','ADMIN')")
    @Operation(summary = "Record an audit event (idempotent per eventId)")
    public ResponseEntity<AuditEventResponse> record(@Valid @RequestBody AuditEventRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(auditService.record(request));
    }

    @GetMapping("/events/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','PROCUREMENT_ADMIN')")
    @Operation(summary = "Get one audit event")
    public ResponseEntity<AuditEventResponse> get(@PathVariable UUID id) {
        return ResponseEntity.ok(auditService.get(id));
    }

    @GetMapping("/events")
    @PreAuthorize("hasAnyRole('ADMIN','PROCUREMENT_ADMIN')")
    @Operation(summary = "Search the audit trail (newest first)")
    public ResponseEntity<PageResponse<AuditEventResponse>> search(
            @RequestParam(required = false) String sourceService,
            @RequestParam(required = false) String eventType,
            @RequestParam(required = false) String aggregateType,
            @RequestParam(required = false) UUID aggregateId,
            @RequestParam(required = false) UUID actorId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @ParameterObject @PageableDefault(size = 50) Pageable pageable) {
        return ResponseEntity.ok(auditService.search(sourceService, eventType, aggregateType, aggregateId, actorId,
                from, to, pageable));
    }

    @GetMapping("/aggregates/{aggregateType}/{aggregateId}")
    @PreAuthorize("hasAnyRole('ADMIN','PROCUREMENT_ADMIN')")
    @Operation(summary = "Chronological history of one business object")
    public ResponseEntity<List<AuditEventResponse>> timeline(@PathVariable String aggregateType,
                                                             @PathVariable UUID aggregateId) {
        return ResponseEntity.ok(auditService.timeline(aggregateType, aggregateId));
    }

    @GetMapping("/verify")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Verify the integrity of the whole hash chain")
    public ResponseEntity<ChainVerificationResponse> verify() {
        return ResponseEntity.ok(auditService.verifyChain());
    }
}
