package com.vqms.document.repository;

import com.vqms.document.entity.DocumentStatusHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

/** Persistence for the append-only document status history. */
public interface DocumentStatusHistoryRepository extends JpaRepository<DocumentStatusHistory, UUID> {

    List<DocumentStatusHistory> findByDocumentIdOrderByCreatedAtAsc(UUID documentId);
}
