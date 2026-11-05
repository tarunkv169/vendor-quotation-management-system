package com.vqms.dto.response;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
public class NotificationResponse {

    private UUID id;
    private UUID userId;
    private String type;
    private String title;
    private String message;
    private String entityType;
    private UUID entityId;
    private String status;
    private LocalDateTime readAt;
    private LocalDateTime createdAt;
}
