package com.vqms.controller;

import com.vqms.dto.request.NotificationRequest;
import com.vqms.dto.response.NotificationResponse;
import com.vqms.service.NotificationService;
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
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping
    public ResponseEntity<Page<NotificationResponse>> getNotifications(
            @RequestHeader("X-User-Id") UUID userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ResponseEntity.ok(notificationService.getNotificationsByUserId(userId, pageable));
    }

    @GetMapping("/status/{status}")
    public ResponseEntity<Page<NotificationResponse>> getNotificationsByStatus(
            @RequestHeader("X-User-Id") UUID userId,
            @PathVariable String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ResponseEntity.ok(notificationService.getNotificationsByUserIdAndStatus(userId, status, pageable));
    }

    @GetMapping("/recent")
    public ResponseEntity<List<NotificationResponse>> getRecentNotifications(
            @RequestHeader("X-User-Id") UUID userId,
            @RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(notificationService.getRecentNotifications(userId, limit));
    }

    @PostMapping
    public ResponseEntity<Void> sendNotification(@Valid @RequestBody NotificationRequest request) {
        UUID userId = UUID.fromString(request.getUserId());
        UUID entityId = request.getEntityId() != null ? UUID.fromString(request.getEntityId()) : null;
        notificationService.sendNotificationWithChannel(
                userId, request.getType(), request.getTitle(), request.getMessage(),
                request.getEntityType(), entityId, request.getChannel());
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    @PostMapping("/bulk")
    public ResponseEntity<Void> sendBulkNotification(
            @RequestBody Map<String, Object> request) {
        @SuppressWarnings("unchecked")
        List<String> userIds = (List<String>) request.get("userIds");
        String type = (String) request.get("type");
        String title = (String) request.get("title");
        String message = (String) request.get("message");
        String channel = (String) request.getOrDefault("channel", "APP");
        String entityType = (String) request.get("entityType");
        String entityIdStr = (String) request.get("entityId");

        List<UUID> uuidList = userIds.stream().map(UUID::fromString).toList();
        UUID entityId = entityIdStr != null ? UUID.fromString(entityIdStr) : null;
        notificationService.sendBulkNotification(uuidList, type, title, message, entityType, entityId, channel);
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    @PostMapping("/template")
    public ResponseEntity<NotificationResponse> sendFromTemplate(
            @RequestBody Map<String, Object> request) {
        String templateName = (String) request.get("templateName");
        String userIdStr = (String) request.get("userId");
        @SuppressWarnings("unchecked")
        Map<String, String> variables = (Map<String, String>) request.getOrDefault("variables", Map.of());
        String entityType = (String) request.get("entityType");
        String entityIdStr = (String) request.get("entityId");

        UUID userId = UUID.fromString(userIdStr);
        UUID entityId = entityIdStr != null ? UUID.fromString(entityIdStr) : null;
        NotificationResponse response = notificationService.sendFromTemplate(
                templateName, userId, variables, entityType, entityId);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PatchMapping("/{id}/read")
    public ResponseEntity<NotificationResponse> markAsRead(
            @PathVariable UUID id,
            @RequestHeader("X-User-Id") UUID userId) {
        return ResponseEntity.ok(notificationService.markAsRead(id, userId));
    }

    @PatchMapping("/mark-all-read")
    public ResponseEntity<Void> markAllAsRead(@RequestHeader("X-User-Id") UUID userId) {
        notificationService.markAllAsRead(userId);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteNotification(
            @PathVariable UUID id,
            @RequestHeader("X-User-Id") UUID userId) {
        notificationService.deleteNotification(id, userId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/unread-count")
    public ResponseEntity<Map<String, Long>> getUnreadCount(@RequestHeader("X-User-Id") UUID userId) {
        long count = notificationService.getUnreadCount(userId);
        return ResponseEntity.ok(Map.of("unreadCount", count));
    }

    @GetMapping("/type/{type}")
    public ResponseEntity<Page<NotificationResponse>> getNotificationsByType(
            @PathVariable String type,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ResponseEntity.ok(notificationService.getNotificationsByType(type, pageable));
    }
}
