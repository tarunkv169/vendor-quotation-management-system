package com.vqms.notification.entity;

import com.vqms.notification.entity.base.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

/** "User X has read notification Y" - needed because role notifications are shared by many users. */
@Entity
@Table(name = "notification_reads")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class NotificationRead extends BaseEntity {

    @Column(name = "notification_id", nullable = false, updatable = false)
    private UUID notificationId;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "read_at", nullable = false)
    private Instant readAt;

    public NotificationRead(UUID notificationId, UUID userId) {
        this.notificationId = notificationId;
        this.userId = userId;
        this.readAt = Instant.now();
    }
}
