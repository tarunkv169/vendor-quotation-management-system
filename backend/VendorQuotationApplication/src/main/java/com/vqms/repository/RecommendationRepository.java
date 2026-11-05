package com.vqms.repository;

import com.vqms.entity.Recommendation;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface RecommendationRepository extends JpaRepository<Recommendation, UUID> {

    Page<Recommendation> findByPurchaseRequestId(UUID purchaseRequestId, Pageable pageable);

    Optional<Recommendation> findFirstByPurchaseRequestIdOrderByCreatedAtDesc(UUID purchaseRequestId);

    void deleteByPurchaseRequestId(UUID purchaseRequestId);
}
