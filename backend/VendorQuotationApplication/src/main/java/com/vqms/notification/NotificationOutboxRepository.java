package com.vqms.notification;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface NotificationOutboxRepository extends JpaRepository<NotificationOutbox, UUID> {

    /** FOR UPDATE SKIP LOCKED: several instances can relay in parallel without sending twice. */
    @Query(value = "SELECT * FROM notification_outbox WHERE sent_at IS NULL AND attempts < :maxAttempts "
            + "AND next_attempt_at <= now() ORDER BY created_at LIMIT :limit FOR UPDATE SKIP LOCKED",
            nativeQuery = true)
    List<NotificationOutbox> lockDue(@Param("maxAttempts") int maxAttempts, @Param("limit") int limit);
}
