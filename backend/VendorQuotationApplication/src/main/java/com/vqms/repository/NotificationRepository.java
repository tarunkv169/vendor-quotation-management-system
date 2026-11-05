package com.vqms.repository;

import com.vqms.entity.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    Page<Notification> findByUserId(UUID userId, Pageable pageable);

    Page<Notification> findByUserIdAndStatus(UUID userId, String status, Pageable pageable);

    long countByUserIdAndStatus(UUID userId, String status);

    Page<Notification> findByType(String type, Pageable pageable);
}
