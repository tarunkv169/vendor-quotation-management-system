package com.vqms.approval.repository;

import com.vqms.approval.entity.ApprovalDelegation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ApprovalDelegationRepository extends JpaRepository<ApprovalDelegation, UUID> {

    List<ApprovalDelegation> findByDelegateIdAndActiveTrue(UUID delegateId);

    List<ApprovalDelegation> findByDelegatorIdAndActiveTrue(UUID delegatorId);

    List<ApprovalDelegation> findByDelegatorIdOrDelegateIdOrderByCreatedAtDesc(UUID delegatorId, UUID delegateId);
}
