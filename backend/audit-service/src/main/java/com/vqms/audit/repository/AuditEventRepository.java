package com.vqms.audit.repository;

import com.vqms.audit.entity.AuditEvent;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AuditEventRepository extends JpaRepository<AuditEvent, UUID>, JpaSpecificationExecutor<AuditEvent> {

    Optional<AuditEvent> findByEventId(UUID eventId);

    List<AuditEvent> findByAggregateTypeAndAggregateIdOrderBySequenceNumberAsc(String aggregateType, UUID aggregateId);

    /** Chain verification walks the table in sequence order, page by page. */
    Slice<AuditEvent> findBySequenceNumberGreaterThanOrderBySequenceNumberAsc(long after, Pageable pageable);

    static Specification<AuditEvent> filter(String sourceService, String eventType, String aggregateType,
                                            UUID aggregateId, UUID actorId, Instant from, Instant to) {
        return (root, query, cb) -> {
            List<Predicate> p = new ArrayList<>();
            if (sourceService != null) {
                p.add(cb.equal(root.get("sourceService"), sourceService));
            }
            if (eventType != null) {
                p.add(cb.equal(root.get("eventType"), eventType));
            }
            if (aggregateType != null) {
                p.add(cb.equal(root.get("aggregateType"), aggregateType));
            }
            if (aggregateId != null) {
                p.add(cb.equal(root.get("aggregateId"), aggregateId));
            }
            if (actorId != null) {
                p.add(cb.equal(root.get("actorId"), actorId));
            }
            if (from != null) {
                p.add(cb.greaterThanOrEqualTo(root.get("occurredAt"), from));
            }
            if (to != null) {
                p.add(cb.lessThan(root.get("occurredAt"), to));
            }
            return cb.and(p.toArray(Predicate[]::new));
        };
    }
}
