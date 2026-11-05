package com.vqms.controller;

import com.vqms.dto.response.AuditLogResponse;
import com.vqms.service.AuditService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/audit")
@RequiredArgsConstructor
public class AuditController {

    private final AuditService auditService;

    @GetMapping("/entity/{entityType}/{entityId}")
    public ResponseEntity<Page<AuditLogResponse>> getAuditByEntity(
            @PathVariable String entityType,
            @PathVariable UUID entityId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ResponseEntity.ok(auditService.getAuditLogsByEntity(entityType, entityId, pageable));
    }

    @GetMapping("/entity/{entityType}/{entityId}/history")
    public ResponseEntity<List<AuditLogResponse>> getEntityHistory(
            @PathVariable String entityType,
            @PathVariable UUID entityId) {
        return ResponseEntity.ok(auditService.getEntityHistory(entityType, entityId));
    }

    @GetMapping("/actor/{actorId}")
    public ResponseEntity<Page<AuditLogResponse>> getAuditByActor(
            @PathVariable UUID actorId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ResponseEntity.ok(auditService.getAuditLogsByActor(actorId, pageable));
    }

    @GetMapping("/range")
    public ResponseEntity<Page<AuditLogResponse>> getAuditByDateRange(
            @RequestParam LocalDateTime start,
            @RequestParam LocalDateTime end,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ResponseEntity.ok(auditService.getAuditLogsByDateRange(start, end, pageable));
    }

    @GetMapping
    public ResponseEntity<Page<AuditLogResponse>> getAllAudit(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ResponseEntity.ok(auditService.getAllAuditLogs(pageable));
    }

    @GetMapping("/action/{action}")
    public ResponseEntity<Page<AuditLogResponse>> getAuditByAction(
            @PathVariable String action,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ResponseEntity.ok(auditService.getAuditLogsByAction(action, pageable));
    }

    @GetMapping("/type/{entityType}")
    public ResponseEntity<Page<AuditLogResponse>> getAuditByEntityType(
            @PathVariable String entityType,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ResponseEntity.ok(auditService.getAuditLogsByEntityType(entityType, pageable));
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getAuditStats(
            @RequestParam String entityType,
            @RequestParam UUID actorId) {
        long entityCount = auditService.countByEntityType(entityType);
        long actorCount = auditService.countByActorId(actorId);
        return ResponseEntity.ok(Map.of(
                "entityTypeCount", entityCount,
                "actorIdCount", actorCount
        ));
    }
}
