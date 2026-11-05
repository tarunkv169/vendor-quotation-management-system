package com.vqms.notification.repository;

import com.vqms.notification.entity.Notification;
import com.vqms.notification.enums.EmailStatus;
import org.springframework.data.domain.Limit;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    Optional<Notification> findByDedupeKey(String dedupeKey);

    /** Notifications addressed to the user directly or to the user's role. */
    @Query("SELECT n FROM Notification n WHERE n.recipientUserId = :userId OR n.recipientRole = :role")
    Page<Notification> findVisible(@Param("userId") UUID userId, @Param("role") String role, Pageable pageable);

    /** Visible notifications without a read receipt of this user. */
    @Query("SELECT n FROM Notification n LEFT JOIN NotificationRead r ON r.notificationId = n.id AND r.userId = :userId "
            + "WHERE (n.recipientUserId = :userId OR n.recipientRole = :role) AND r.id IS NULL")
    Page<Notification> findUnread(@Param("userId") UUID userId, @Param("role") String role, Pageable pageable);

    @Query("SELECT COUNT(n) FROM Notification n LEFT JOIN NotificationRead r ON r.notificationId = n.id "
            + "AND r.userId = :userId WHERE (n.recipientUserId = :userId OR n.recipientRole = :role) AND r.id IS NULL")
    long countUnread(@Param("userId") UUID userId, @Param("role") String role);

    @Query("SELECT n.id FROM Notification n LEFT JOIN NotificationRead r ON r.notificationId = n.id "
            + "AND r.userId = :userId WHERE (n.recipientUserId = :userId OR n.recipientRole = :role) AND r.id IS NULL")
    List<UUID> findUnreadIds(@Param("userId") UUID userId, @Param("role") String role);

    List<Notification> findByEmailStatusOrderByCreatedAtAsc(EmailStatus status, Limit limit);
}
