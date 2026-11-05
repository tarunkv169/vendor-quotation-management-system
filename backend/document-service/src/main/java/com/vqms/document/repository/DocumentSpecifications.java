package com.vqms.document.repository;

import com.vqms.document.entity.Document;
import com.vqms.document.enums.DocumentStatus;
import com.vqms.document.enums.DocumentType;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Builds type-safe dynamic WHERE clauses for document searches.
 * Null filters are ignored. Deleted documents are excluded unless DELETED is requested explicitly.
 */
public final class DocumentSpecifications {

    private DocumentSpecifications() {
    }

    public static Specification<Document> matching(DocumentType documentType,
                                                   DocumentStatus status,
                                                   UUID quotationId,
                                                   UUID vendorId,
                                                   UUID procurementRequestId) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (status != null) {
                predicates.add(cb.equal(root.get("documentStatus"), status));
            } else {
                predicates.add(cb.notEqual(root.get("documentStatus"), DocumentStatus.DELETED));
            }
            if (documentType != null) {
                predicates.add(cb.equal(root.get("documentType"), documentType));
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
