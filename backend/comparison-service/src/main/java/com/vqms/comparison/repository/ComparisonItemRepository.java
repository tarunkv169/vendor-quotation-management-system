package com.vqms.comparison.repository;

import com.vqms.comparison.entity.ComparisonItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

/** Read access to individual results (writes go through the Comparison aggregate). */
public interface ComparisonItemRepository extends JpaRepository<ComparisonItem, UUID> {

    List<ComparisonItem> findByComparisonIdOrderByRankPositionAsc(UUID comparisonId);

    List<ComparisonItem> findByQuotationId(UUID quotationId);
}
