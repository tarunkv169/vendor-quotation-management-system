package com.vqms.service.impl;

import com.vqms.dto.response.NotificationResponse;
import com.vqms.entity.Notification;
import com.vqms.exception.BadRequestException;
import com.vqms.repository.NotificationRepository;
import com.vqms.service.NotificationService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class NotificationServiceImpl implements NotificationService {

    private final NotificationRepository notificationRepository;

    private static final Map<String, String> TEMPLATES = new HashMap<>();

    static {
        TEMPLATES.put("QUOTATION_UPLOADED", "New quotation uploaded for {requestName} by {vendorName}");
        TEMPLATES.put("QUOTATION_APPROVED", "Your quotation for {requestName} has been approved");
        TEMPLATES.put("QUOTATION_REJECTED", "Your quotation for {requestName} has been rejected. Reason: {reason}");
        TEMPLATES.put("APPROVAL_REQUESTED", "Approval requested for {requestName}. Amount: {amount}");
        TEMPLATES.put("APPROVAL_COMPLETED", "Approval for {requestName} has been {decision}");
        TEMPLATES.put("REQUEST_SUBMITTED", "Purchase request {requestNumber} has been submitted");
        TEMPLATES.put("DEADLINE_REMINDER", "Quotation deadline for {requestName} is approaching: {deadline}");
        TEMPLATES.put("VENDOR_QUOTATION_REQUEST", "Quotation requested for {requestName}. Deadline: {deadline}");
    }

    @Override
    public void sendNotification(UUID userId, String type, String title, String message, String entityType, UUID entityId) {
        sendNotificationWithChannel(userId, type, title, message, entityType, entityId, "APP");
    }

    @Override
    public void sendNotificationWithChannel(UUID userId, String type, String title, String message,
                                            String entityType, UUID entityId, String channel) {
        Notification notification = new Notification();
        notification.setUserId(userId);
        notification.setType(type);
        notification.setTitle(title);
        notification.setMessage(message);
        notification.setEntityType(entityType);
        notification.setEntityId(entityId);
        notification.setStatus("PENDING");
        notificationRepository.save(notification);

        // Log channel-specific sending (in production, integrate with email/SMS providers)
        if ("EMAIL".equals(channel)) {
            // TODO: Integrate with JavaMailSender
        } else if ("SMS".equals(channel)) {
            // TODO: Integrate with SMS provider
        }
    }

    @Override
    public void sendBulkNotification(List<UUID> userIds, String type, String title, String message,
                                     String entityType, UUID entityId, String channel) {
        if (userIds == null || userIds.isEmpty()) {
            throw new BadRequestException("User IDs list cannot be empty");
        }
        for (UUID userId : userIds) {
            sendNotificationWithChannel(userId, type, title, message, entityType, entityId, channel);
        }
    }

    @Override
    public NotificationResponse sendFromTemplate(String templateName, UUID userId, Map<String, String> variables,
                                                  String entityType, UUID entityId) {
        String template = TEMPLATES.get(templateName);
        if (template == null) {
            throw new BadRequestException("Template not found: " + templateName);
        }

        String title = templateName.replace("_", " ").toLowerCase();
        String message = template;
        if (variables != null) {
            for (Map.Entry<String, String> entry : variables.entrySet()) {
                message = message.replace("{" + entry.getKey() + "}", entry.getValue());
            }
        }

        Notification notification = new Notification();
        notification.setUserId(userId);
        notification.setType(templateName);
        notification.setTitle(title);
        notification.setMessage(message);
        notification.setEntityType(entityType);
        notification.setEntityId(entityId);
        notification.setStatus("PENDING");
        Notification saved = notificationRepository.save(notification);
        return toResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<NotificationResponse> getNotificationsByUserId(UUID userId, Pageable pageable) {
        return notificationRepository.findByUserId(userId, pageable).map(this::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<NotificationResponse> getNotificationsByUserIdAndStatus(UUID userId, String status, Pageable pageable) {
        return notificationRepository.findByUserIdAndStatus(userId, status, pageable).map(this::toResponse);
    }

    @Override
    public NotificationResponse markAsRead(UUID notificationId, UUID userId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new EntityNotFoundException("Notification not found"));
        if (!notification.getUserId().equals(userId)) {
            throw new BadRequestException("Not authorized");
        }
        notification.setReadAt(LocalDateTime.now());
        notification.setStatus("READ");
        Notification saved = notificationRepository.save(notification);
        return toResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public long getUnreadCount(UUID userId) {
        return notificationRepository.countByUserIdAndStatus(userId, "PENDING");
    }

    @Override
    public void markAllAsRead(UUID userId) {
        Page<Notification> pending = notificationRepository.findByUserIdAndStatus(userId, "PENDING", Pageable.ofSize(1000));
        LocalDateTime now = LocalDateTime.now();
        pending.getContent().forEach(n -> {
            n.setReadAt(now);
            n.setStatus("READ");
        });
        notificationRepository.saveAll(pending.getContent());
    }

    @Override
    public void deleteNotification(UUID notificationId, UUID userId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new EntityNotFoundException("Notification not found"));
        if (!notification.getUserId().equals(userId)) {
            throw new BadRequestException("Not authorized");
        }
        notificationRepository.delete(notification);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<NotificationResponse> getNotificationsByType(String type, Pageable pageable) {
        return notificationRepository.findByType(type, pageable).map(this::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public List<NotificationResponse> getRecentNotifications(UUID userId, int limit) {
        Pageable pageable = PageRequest.of(0, Math.min(limit, 50));
        return notificationRepository.findByUserId(userId, pageable)
                .getContent().stream()
                .map(this::toResponse)
                .toList();
    }

    private NotificationResponse toResponse(Notification notification) {
        NotificationResponse response = new NotificationResponse();
        response.setId(notification.getId());
        response.setUserId(notification.getUserId());
        response.setType(notification.getType());
        response.setTitle(notification.getTitle());
        response.setMessage(notification.getMessage());
        response.setEntityType(notification.getEntityType());
        response.setEntityId(notification.getEntityId());
        response.setStatus(notification.getStatus());
        response.setReadAt(notification.getReadAt());
        response.setCreatedAt(notification.getCreatedAt());
        return response;
    }
}
