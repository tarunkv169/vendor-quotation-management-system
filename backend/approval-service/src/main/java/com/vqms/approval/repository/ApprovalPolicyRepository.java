package com.vqms.approval.repository;

import com.vqms.approval.entity.ApprovalPolicy;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ApprovalPolicyRepository extends JpaRepository<ApprovalPolicy, UUID> {

    List<ApprovalPolicy> findByActiveTrueAndCurrencyCode(String currencyCode);

    boolean existsByCode(String code);
}
