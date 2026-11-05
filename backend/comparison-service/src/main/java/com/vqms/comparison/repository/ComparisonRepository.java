package com.vqms.comparison.repository;

import com.vqms.comparison.entity.Comparison;
import com.vqms.comparison.enums.ComparisonStatus;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ComparisonRepository extends JpaRepository<Comparison, UUID>, JpaSpecificationExecutor<Comparison> {

    /** Loads the results in the same query (no lazy loading after the transaction). */
    @EntityGraph(attributePaths = "items")
    Optional<Comparison> findWithItemsById(UUID id);

    List<Comparison> findByProcurementRequestIdAndStatus(UUID procurementRequestId, ComparisonStatus status);

    boolean existsByComparisonNumber(String comparisonNumber);

    /** Dynamic filter; null arguments are ignored. */
    static Specification<Comparison> filter(ComparisonStatus status, UUID procurementRequestId) {
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
