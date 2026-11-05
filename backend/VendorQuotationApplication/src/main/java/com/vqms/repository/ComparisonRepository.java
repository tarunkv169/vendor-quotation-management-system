package com.vqms.repository;

import com.vqms.entity.Comparison;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ComparisonRepository extends JpaRepository<Comparison, UUID> {

    Page<Comparison> findByPurchaseRequestId(UUID purchaseRequestId, Pageable pageable);

    List<Comparison> findByPurchaseRequestId(UUID purchaseRequestId);

    Page<Comparison> findByCreatedBy(UUID createdBy, Pageable pageable);
}
