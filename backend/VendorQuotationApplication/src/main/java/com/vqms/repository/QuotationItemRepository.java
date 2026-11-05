package com.vqms.repository;

import com.vqms.entity.QuotationItem;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface QuotationItemRepository extends JpaRepository<QuotationItem, UUID> {

    List<QuotationItem> findByQuotationId(UUID quotationId);

    Page<QuotationItem> findByQuotationId(UUID quotationId, Pageable pageable);

    void deleteByQuotationId(UUID quotationId);
}
