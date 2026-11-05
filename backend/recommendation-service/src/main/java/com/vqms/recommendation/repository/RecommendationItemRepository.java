package com.vqms.recommendation.repository;

import com.vqms.recommendation.entity.RecommendationItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

/** Read access to evaluations (writes go through the Recommendation aggregate). */
public interface RecommendationItemRepository extends JpaRepository<RecommendationItem, UUID> {

    List<RecommendationItem> findByQuotationId(UUID quotationId);
}
