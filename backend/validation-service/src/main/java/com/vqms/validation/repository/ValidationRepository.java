package com.vqms.validation.repository;

import com.vqms.validation.entity.ValidationRecord;
import com.vqms.validation.enums.ValidationStatus;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Persistence for validation records (issues are saved through the cascade). */
public interface ValidationRepository extends JpaRepository<ValidationRecord, UUID>,
        JpaSpecificationExecutor<ValidationRecord> {

    /** {@code @EntityGraph} loads the issues in the same query (no N+1, no lazy loading later). */
    @EntityGraph(attributePaths = "issues")
    Optional<ValidationRecord> findWithIssuesById(UUID id);

    /** Dynamic filter; null arguments are ignored. */
    static Specification<ValidationRecord> filter(ValidationStatus status, UUID quotationId, UUID vendorId,
                                                  UUID procurementRequestId) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (quotationId != null) {
                predicates.add(cb.equal(root.get("quotationId"), quotationId));
            }
            if (vendorId != null) {
                predicates.add(cb.equal(root.get("vendorId"), vendorId));
            }
            if (procurementRequestId != null) {
                predicates.add(cb.equal(root.get("procurementRequestId"), procurementRequestId));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }
}
