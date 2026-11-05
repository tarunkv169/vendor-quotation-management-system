package com.vqms.audit.repository;

import com.vqms.audit.entity.AuditChainHead;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface AuditChainHeadRepository extends JpaRepository<AuditChainHead, Short> {

    /** SELECT ... FOR UPDATE: one writer at a time extends the chain (also across service instances). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT h FROM AuditChainHead h WHERE h.id = 1")
    Optional<AuditChainHead> lockHead();
}
