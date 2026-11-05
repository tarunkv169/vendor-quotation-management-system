package com.vqms.notification.controller;

import com.vqms.notification.constants.NotificationConstants;
import com.vqms.notification.dto.request.NotificationRequest;
import com.vqms.notification.dto.response.NotificationResponse;
import com.vqms.notification.dto.response.PageResponse;
import com.vqms.notification.service.NotificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

/** Notification inbox. Every authenticated user (vendors included) can read their own notifications. */
@RestController
@RequestMapping(NotificationConstants.API_BASE_PATH)
@Tag(name = "Notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('INTERNAL_SERVICE','ADMIN','PROCUREMENT_ADMIN')")
    @Operation(summary = "Send a notification to a user or to all users of a role")
    public ResponseEntity<NotificationResponse> send(@Valid @RequestBody NotificationRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(notificationService.send(request));
    }

    @GetMapping("/my")
    @Operation(summary = "My notifications (newest first)")
    public ResponseEntity<PageResponse<NotificationResponse>> my(
            @RequestParam(defaultValue = "false") boolean unreadOnly,
            @ParameterObject @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(notificationService.myNotifications(unreadOnly, pageable));
    }

    @GetMapping("/my/unread-count")
    @Operation(summary = "Number of unread notifications")
    public ResponseEntity<Map<String, Long>> unreadCount() {
        return ResponseEntity.ok(Map.of("unread", notificationService.unreadCount()));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get one of my notifications")
    public ResponseEntity<NotificationResponse> get(@PathVariable UUID id) {
        return ResponseEntity.ok(notificationService.get(id));
    }

    @PatchMapping("/{id}/read")
    @Operation(summary = "Mark a notification as read")
    public ResponseEntity<NotificationResponse> markRead(@PathVariable UUID id) {
        return ResponseEntity.ok(notificationService.markRead(id));
    }

    @PatchMapping("/my/read-all")
    @Operation(summary = "Mark all my notifications as read")
    public ResponseEntity<Map<String, Integer>> markAllRead() {
        return ResponseEntity.ok(Map.of("marked", notificationService.markAllRead()));
    }
}
