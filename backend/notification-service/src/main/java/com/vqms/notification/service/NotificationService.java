package com.vqms.notification.service;

import com.vqms.notification.dto.request.NotificationRequest;
import com.vqms.notification.dto.response.NotificationResponse;
import com.vqms.notification.dto.response.PageResponse;
import org.springframework.data.domain.Pageable;

import java.util.UUID;

/** Notification use cases. Users only ever see notifications addressed to them or to their role. */
public interface NotificationService {

    NotificationResponse send(NotificationRequest request);

    /** Used by event consumers (no HTTP caller); idempotent through the dedupe key. */
    void sendSystem(NotificationRequest request);

    PageResponse<NotificationResponse> myNotifications(boolean unreadOnly, Pageable pageable);

    long unreadCount();

    NotificationResponse get(UUID id);

    NotificationResponse markRead(UUID id);

    int markAllRead();
}
