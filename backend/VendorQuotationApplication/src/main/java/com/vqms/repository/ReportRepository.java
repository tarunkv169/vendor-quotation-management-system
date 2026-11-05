package com.vqms.repository;

import com.vqms.entity.Report;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.UUID;

@Repository
public interface ReportRepository extends JpaRepository<Report, UUID> {

    Page<Report> findByReportType(String reportType, Pageable pageable);

    Page<Report> findByGeneratedBy(UUID generatedBy, Pageable pageable);

    @Query("SELECT r FROM Report r WHERE r.generatedAt BETWEEN :start AND :end ORDER BY r.generatedAt DESC")
    Page<Report> findByDateRange(LocalDateTime start, LocalDateTime end, Pageable pageable);

    long countByReportType(String reportType);
}
