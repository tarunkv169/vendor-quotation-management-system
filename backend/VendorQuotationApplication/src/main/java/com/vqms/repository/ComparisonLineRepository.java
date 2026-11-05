package com.vqms.repository;

import com.vqms.entity.ComparisonLine;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ComparisonLineRepository extends JpaRepository<ComparisonLine, UUID> {

    List<ComparisonLine> findByComparisonId(UUID comparisonId);

    void deleteByComparisonId(UUID comparisonId);
}
