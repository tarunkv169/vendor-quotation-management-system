package com.vqms.repository;

import com.vqms.entity.Quotation;
import com.vqms.entity.QuotationStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface QuotationRepository extends JpaRepository<Quotation, UUID> {

    Page<Quotation> findByPurchaseRequestId(UUID purchaseRequestId, Pageable pageable);

    Page<Quotation> findByVendorId(UUID vendorId, Pageable pageable);

    Page<Quotation> findByStatus(QuotationStatus status, Pageable pageable);

    Page<Quotation> findByPurchaseRequestIdAndStatus(UUID purchaseRequestId, QuotationStatus status, Pageable pageable);

    List<Quotation> findByPurchaseRequestIdAndStatus(UUID purchaseRequestId, QuotationStatus status);

    Page<Quotation> findByVendorIdAndStatus(UUID vendorId, QuotationStatus status, Pageable pageable);

    boolean existsByPurchaseRequestIdAndVendorId(UUID purchaseRequestId, UUID vendorId);

    long countByVendorId(UUID vendorId);
}
