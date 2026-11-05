package com.vqms.repository;

import com.vqms.entity.ProcurementItem;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ProcurementItemRepository
        extends JpaRepository<ProcurementItem, UUID> {

    // Find all items for a procurement request, ordered by creation time
    Page<ProcurementItem> findByProcurementRequestId(
            UUID procurementRequestId,
            Pageable pageable
    );

    // Find all items for a procurement request as a list
    List<ProcurementItem> findByProcurementRequestIdOrderByCreatedAtAsc(
            UUID procurementRequestId
    );

    // Count items for a procurement request
    long countByProcurementRequestId(UUID procurementRequestId);

    // Delete all items for a procurement request
    void deleteByProcurementRequestId(UUID procurementRequestId);
}
