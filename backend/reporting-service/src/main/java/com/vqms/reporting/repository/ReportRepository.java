package com.vqms.reporting.repository;

import com.vqms.reporting.entity.Report;
import com.vqms.reporting.enums.ReportType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface ReportRepository extends JpaRepository<Report, UUID> {

    Page<Report> findByReportType(ReportType type, Pageable pageable);

    boolean existsByReportNumber(String reportNumber);
}
