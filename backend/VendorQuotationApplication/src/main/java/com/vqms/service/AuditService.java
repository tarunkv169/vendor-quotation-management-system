package com.vqms.service;

import com.vqms.dto.response.AuditLogResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface AuditService {

    void logAudit(String entityType, UUID entityId, String action, UUID actorId, String actorName, String details);

    void logAuditWithState(String entityType, UUID entityId, String action, UUID actorId, String actorName,
                           String details, String beforeState, String afterState);

    void logAuditFull(String entityType, UUID entityId, String action, UUID actorId, String actorName,
                      String details, String beforeState, String afterState, String ipAddress,
                      String userAgent, String correlationId);

    Page<AuditLogResponse> getAuditLogsByEntity(String entityType, UUID entityId, Pageable pageable);

    Page<AuditLogResponse> getAuditLogsByActor(UUID actorId, Pageable pageable);

    Page<AuditLogResponse> getAuditLogsByDateRange(LocalDateTime start, LocalDateTime end, Pageable pageable);

    Page<AuditLogResponse> getAllAuditLogs(Pageable pageable);

    Page<AuditLogResponse> getAuditLogsByAction(String action, Pageable pageable);

    Page<AuditLogResponse> getAuditLogsByEntityType(String entityType, Pageable pageable);

    List<AuditLogResponse> getEntityHistory(String entityType, UUID entityId);

    long countByEntityType(String entityType);

    long countByActorId(UUID actorId);
}
