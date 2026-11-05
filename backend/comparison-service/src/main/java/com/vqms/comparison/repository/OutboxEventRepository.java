package com.vqms.comparison.repository;

import com.vqms.comparison.entity.OutboxEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface OutboxEventRepository extends JpaRepository<OutboxEvent, UUID> {

    /** FOR UPDATE SKIP LOCKED lets several service instances relay in parallel without duplicates. */
    @Query(value = "SELECT * FROM outbox_events WHERE published_at IS NULL ORDER BY created_at "
            + "LIMIT :limit FOR UPDATE SKIP LOCKED", nativeQuery = true)
    List<OutboxEvent> lockUnpublished(@Param("limit") int limit);
}
