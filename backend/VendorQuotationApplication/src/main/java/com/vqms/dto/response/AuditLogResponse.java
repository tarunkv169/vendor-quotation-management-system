package com.vqms.dto.response;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
public class AuditLogResponse {

    private UUID id;
    private String entityType;
    private UUID entityId;
    private String action;
    private UUID actorId;
    private String actorName;
    private String details;
    private String beforeState;
    private String afterState;
    private String ipAddress;
    private String userAgent;
    private String correlationId;
    private LocalDateTime createdAt;
}
