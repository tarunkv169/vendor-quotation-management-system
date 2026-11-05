package com.vqms.service;

import com.vqms.dto.request.NotificationRequest;
import com.vqms.dto.response.NotificationResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.UUID;

public interface NotificationService {

    void sendNotification(UUID userId, String type, String title, String message, String entityType, UUID entityId);

    void sendNotificationWithChannel(UUID userId, String type, String title, String message,
                                     String entityType, UUID entityId, String channel);

    void sendBulkNotification(List<UUID> userIds, String type, String title, String message,
                              String entityType, UUID entityId, String channel);

    NotificationResponse sendFromTemplate(String templateName, UUID userId, java.util.Map<String, String> variables,
                                          String entityType, UUID entityId);

    Page<NotificationResponse> getNotificationsByUserId(UUID userId, Pageable pageable);

    Page<NotificationResponse> getNotificationsByUserIdAndStatus(UUID userId, String status, Pageable pageable);

    NotificationResponse markAsRead(UUID notificationId, UUID userId);

    long getUnreadCount(UUID userId);

    void markAllAsRead(UUID userId);

    void deleteNotification(UUID notificationId, UUID userId);

    Page<NotificationResponse> getNotificationsByType(String type, Pageable pageable);

    List<NotificationResponse> getRecentNotifications(UUID userId, int limit);
}
