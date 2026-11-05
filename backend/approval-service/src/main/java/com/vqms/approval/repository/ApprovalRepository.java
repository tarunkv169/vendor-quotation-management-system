package com.vqms.approval.repository;

import com.vqms.approval.entity.Approval;
import com.vqms.approval.enums.ApprovalStatus;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ApprovalRepository extends JpaRepository<Approval, UUID>, JpaSpecificationExecutor<Approval> {

    @EntityGraph(attributePaths = "steps")
    Optional<Approval> findWithStepsById(UUID id);

    boolean existsByApprovalNumber(String approvalNumber);

    boolean existsByRecommendationIdAndStatusIn(UUID recommendationId, Collection<ApprovalStatus> statuses);

    /** Open approvals with at least one pending step (candidates for the current user's inbox). */
    @EntityGraph(attributePaths = "steps")
    @Query("SELECT DISTINCT a FROM Approval a JOIN a.steps s WHERE a.status IN :statuses AND s.status = "
            + "com.vqms.approval.enums.ApprovalStepStatus.PENDING")
    List<Approval> findOpenWithPendingSteps(Collection<ApprovalStatus> statuses);

    static Specification<Approval> filter(ApprovalStatus status, UUID procurementRequestId) {
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
