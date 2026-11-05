package com.vqms.service.impl;

import com.vqms.dto.response.AuditLogResponse;
import com.vqms.entity.AuditLog;
import com.vqms.repository.AuditLogRepository;
import com.vqms.service.AuditService;
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
public class AuditServiceImpl implements AuditService {

    private final AuditLogRepository auditLogRepository;

    @Override
    public void logAudit(String entityType, UUID entityId, String action, UUID actorId, String actorName, String details) {
        logAuditFull(entityType, entityId, action, actorId, actorName, details, null, null, null, null, null);
    }

    @Override
    public void logAuditWithState(String entityType, UUID entityId, String action, UUID actorId, String actorName,
                                  String details, String beforeState, String afterState) {
        logAuditFull(entityType, entityId, action, actorId, actorName, details, beforeState, afterState, null, null, null);
    }

    @Override
    public void logAuditFull(String entityType, UUID entityId, String action, UUID actorId, String actorName,
                             String details, String beforeState, String afterState, String ipAddress,
                             String userAgent, String correlationId) {
        AuditLog log = new AuditLog();
        log.setEntityType(entityType);
        log.setEntityId(entityId);
        log.setAction(action);
        log.setActorId(actorId);
        log.setActorName(actorName);
        log.setDetails(details);
        log.setBeforeState(beforeState);
        log.setAfterState(afterState);
        log.setIpAddress(ipAddress);
        log.setUserAgent(userAgent);
        log.setCorrelationId(correlationId);
        auditLogRepository.save(log);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AuditLogResponse> getAuditLogsByEntity(String entityType, UUID entityId, Pageable pageable) {
        return auditLogRepository.findByEntityTypeAndEntityId(entityType, entityId, pageable).map(this::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AuditLogResponse> getAuditLogsByActor(UUID actorId, Pageable pageable) {
        return auditLogRepository.findByActorId(actorId, pageable).map(this::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AuditLogResponse> getAuditLogsByDateRange(LocalDateTime start, LocalDateTime end, Pageable pageable) {
        return auditLogRepository.findByDateRange(start, end, pageable).map(this::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AuditLogResponse> getAllAuditLogs(Pageable pageable) {
        return auditLogRepository.findAll(pageable).map(this::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AuditLogResponse> getAuditLogsByAction(String action, Pageable pageable) {
        return auditLogRepository.findByAction(action, pageable).map(this::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AuditLogResponse> getAuditLogsByEntityType(String entityType, Pageable pageable) {
        return auditLogRepository.findByEntityType(entityType, pageable).map(this::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public List<AuditLogResponse> getEntityHistory(String entityType, UUID entityId) {
        return auditLogRepository.findByEntityTypeAndEntityId(entityType, entityId, Pageable.unpaged())
                .getContent().stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public long countByEntityType(String entityType) {
        return auditLogRepository.countByEntityType(entityType);
    }

    @Override
    @Transactional(readOnly = true)
    public long countByActorId(UUID actorId) {
        return auditLogRepository.countByActorId(actorId);
    }

    private AuditLogResponse toResponse(AuditLog log) {
        AuditLogResponse response = new AuditLogResponse();
        response.setId(log.getId());
        response.setEntityType(log.getEntityType());
        response.setEntityId(log.getEntityId());
        response.setAction(log.getAction());
        response.setActorId(log.getActorId());
        response.setActorName(log.getActorName());
        response.setDetails(log.getDetails());
        response.setBeforeState(log.getBeforeState());
        response.setAfterState(log.getAfterState());
        response.setIpAddress(log.getIpAddress());
        response.setCorrelationId(log.getCorrelationId());
        response.setCreatedAt(log.getCreatedAt());
        return response;
    }
}
