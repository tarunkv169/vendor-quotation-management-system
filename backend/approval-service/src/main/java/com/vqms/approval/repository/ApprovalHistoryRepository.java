package com.vqms.approval.repository;

import com.vqms.approval.entity.ApprovalHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ApprovalHistoryRepository extends JpaRepository<ApprovalHistory, UUID> {

    List<ApprovalHistory> findByApprovalIdOrderByCreatedAtAsc(UUID approvalId);
}
