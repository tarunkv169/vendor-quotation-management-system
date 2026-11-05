package com.vqms.notification.repository;

import com.vqms.notification.entity.NotificationRead;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface NotificationReadRepository extends JpaRepository<NotificationRead, UUID> {

    boolean existsByNotificationIdAndUserId(UUID notificationId, UUID userId);

    List<NotificationRead> findByUserIdAndNotificationIdIn(UUID userId, Collection<UUID> notificationIds);
}
