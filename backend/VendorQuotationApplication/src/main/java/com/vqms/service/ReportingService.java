package com.vqms.service;

import com.vqms.dto.response.ReportResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

public interface ReportingService {

    Map<String, Object> getProcurementSummary();

    Map<String, Object> getProcurementReportByDateRange(LocalDate start, LocalDate end);

    Map<String, Object> getQuotationSummary();

    Map<String, Object> getQuotationReportByDateRange(LocalDate start, LocalDate end);

    Map<String, Object> getVendorPerformanceReport();

    Map<String, Object> getApprovalSummary();

    Map<String, Object> getCostSavingReport();

    Map<String, Object> getProcurementAnalytics();

    ReportResponse generateReport(String reportType, String reportName, UUID userId);

    Page<ReportResponse> getReports(Pageable pageable);

    Page<ReportResponse> getReportsByType(String reportType, Pageable pageable);

    Map<String, Object> getDashboardStats();
}
