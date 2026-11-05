package com.vqms.recommendation.repository;

import com.vqms.recommendation.entity.Recommendation;
import com.vqms.recommendation.enums.RecommendationStatus;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RecommendationRepository extends JpaRepository<Recommendation, UUID>,
        JpaSpecificationExecutor<Recommendation> {

    @EntityGraph(attributePaths = "items")
    Optional<Recommendation> findWithItemsById(UUID id);

    boolean existsByRecommendationNumber(String recommendationNumber);

    /** Current (not superseded) recommendations of a comparison. */
    List<Recommendation> findByComparisonIdAndStatusNot(UUID comparisonId, RecommendationStatus status);

    static Specification<Recommendation> filter(RecommendationStatus status, UUID procurementRequestId) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (procurementRequestId != null) {
                predicates.add(cb.equal(root.get("procurementRequestId"), procurementRequestId));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }
}
