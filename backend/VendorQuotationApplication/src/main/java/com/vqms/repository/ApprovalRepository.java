package com.vqms.repository;

import com.vqms.entity.Approval;
import com.vqms.entity.ApprovalStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ApprovalRepository extends JpaRepository<Approval, UUID> {

    Page<Approval> findByPurchaseRequestId(UUID purchaseRequestId, Pageable pageable);

    Page<Approval> findByApproverId(UUID approverId, Pageable pageable);

    Page<Approval> findByStatus(ApprovalStatus status, Pageable pageable);

    Page<Approval> findByApproverIdAndStatus(UUID approverId, ApprovalStatus status, Pageable pageable);

    List<Approval> findByPurchaseRequestIdAndStatus(UUID purchaseRequestId, ApprovalStatus status);

    boolean existsByPurchaseRequestIdAndStatus(UUID purchaseRequestId, ApprovalStatus status);

    List<Approval> findByPurchaseRequestIdOrderByApprovalLevelAsc(UUID purchaseRequestId);

    Optional<Approval> findByPurchaseRequestIdAndApprovalLevel(UUID purchaseRequestId, Integer approvalLevel);

    Page<Approval> findByQuotationId(UUID quotationId, Pageable pageable);

    List<Approval> findByQuotationIdOrderByApprovalLevelAsc(UUID quotationId);

    @Query("SELECT a FROM Approval a WHERE a.approverId = :approverId AND a.status = :status AND a.dueDate < :now")
    Page<Approval> findOverdueApprovals(@Param("approverId") UUID approverId,
                                        @Param("status") ApprovalStatus status,
                                        @Param("now") LocalDateTime now,
                                        Pageable pageable);

    long countByPurchaseRequestIdAndStatus(UUID purchaseRequestId, ApprovalStatus status);

    boolean existsByPurchaseRequestIdAndApprovalLevel(UUID purchaseRequestId, Integer approvalLevel);

    long countByQuotationIdAndStatus(UUID quotationId, ApprovalStatus status);
}
