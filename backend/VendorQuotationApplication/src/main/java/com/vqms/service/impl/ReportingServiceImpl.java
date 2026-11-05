package com.vqms.service.impl;

import com.vqms.dto.response.ReportResponse;
import com.vqms.entity.*;
import com.vqms.repository.*;
import com.vqms.service.ReportingService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class ReportingServiceImpl implements ReportingService {

    private final ProcurementRequestRepository procurementRequestRepository;
    private final QuotationRepository quotationRepository;
    private final VendorRepository vendorRepository;
    private final ApprovalRepository approvalRepository;
    private final ReportRepository reportRepository;

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> getProcurementSummary() {
        List<ProcurementRequest> all = procurementRequestRepository.findAll();

        long total = all.size();
        long draft = all.stream().filter(p -> ProcurementStatus.DRAFT == p.getStatus()).count();
        long submitted = all.stream().filter(p -> ProcurementStatus.SUBMITTED == p.getStatus()).count();
        long approved = all.stream().filter(p -> ProcurementStatus.APPROVED == p.getStatus()).count();
        long rejected = all.stream().filter(p -> ProcurementStatus.REJECTED == p.getStatus()).count();
        long completed = all.stream().filter(p -> ProcurementStatus.COMPLETED == p.getStatus()).count();

        BigDecimal totalBudget = all.stream()
                .map(ProcurementRequest::getBudget)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, Object> result = new HashMap<>();
        result.put("totalRequests", total);
        result.put("draft", draft);
        result.put("submitted", submitted);
        result.put("approved", approved);
        result.put("rejected", rejected);
        result.put("completed", completed);
        result.put("totalBudget", totalBudget);
        result.put("averageBudget", total > 0 ? totalBudget.divide(BigDecimal.valueOf(total), 2, java.math.RoundingMode.HALF_UP) : BigDecimal.ZERO);
        return result;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> getProcurementReportByDateRange(LocalDate start, LocalDate end) {
        LocalDateTime startDt = start.atStartOfDay();
        LocalDateTime endDt = end.plusDays(1).atStartOfDay();
        List<ProcurementRequest> filtered = procurementRequestRepository.findAll().stream()
                .filter(p -> p.getCreatedAt() != null && !p.getCreatedAt().isBefore(startDt) && !p.getCreatedAt().isAfter(endDt))
                .collect(Collectors.toList());

        Map<String, Long> statusBreakdown = new HashMap<>();
        for (ProcurementRequest p : filtered) {
            String status = p.getStatus() != null ? p.getStatus().name() : "UNKNOWN";
            statusBreakdown.merge(status, 1L, Long::sum);
        }

        BigDecimal totalBudget = filtered.stream()
                .map(ProcurementRequest::getBudget)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, Object> result = new HashMap<>();
        result.put("startDate", start);
        result.put("endDate", end);
        result.put("totalRequests", filtered.size());
        result.put("statusBreakdown", statusBreakdown);
        result.put("totalBudget", totalBudget);
        return result;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> getQuotationSummary() {
        List<Quotation> all = quotationRepository.findAll();

        long total = all.size();
        long uploaded = all.stream().filter(q -> QuotationStatus.UPLOADED == q.getStatus()).count();
        long validated = all.stream().filter(q -> QuotationStatus.VALIDATED == q.getStatus()).count();
        long rejected = all.stream().filter(q -> QuotationStatus.REJECTED == q.getStatus()).count();
        long submitted = all.stream().filter(q -> QuotationStatus.SUBMITTED == q.getStatus()).count();

        BigDecimal totalAmount = all.stream()
                .map(Quotation::getTotalAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, Object> result = new HashMap<>();
        result.put("totalQuotations", total);
        result.put("uploaded", uploaded);
        result.put("validated", validated);
        result.put("rejected", rejected);
        result.put("submitted", submitted);
        result.put("totalAmount", totalAmount);
        result.put("averageAmount", total > 0 ? totalAmount.divide(BigDecimal.valueOf(total), 2, java.math.RoundingMode.HALF_UP) : BigDecimal.ZERO);
        return result;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> getQuotationReportByDateRange(LocalDate start, LocalDate end) {
        LocalDateTime startDt = start.atStartOfDay();
        LocalDateTime endDt = end.plusDays(1).atStartOfDay();
        List<Quotation> filtered = quotationRepository.findAll().stream()
                .filter(q -> q.getCreatedAt() != null && !q.getCreatedAt().isBefore(startDt) && !q.getCreatedAt().isAfter(endDt))
                .collect(Collectors.toList());

        Map<String, Long> statusBreakdown = new HashMap<>();
        for (Quotation q : filtered) {
            String status = q.getStatus() != null ? q.getStatus().name() : "UNKNOWN";
            statusBreakdown.merge(status, 1L, Long::sum);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("startDate", start);
        result.put("endDate", end);
        result.put("totalQuotations", filtered.size());
        result.put("statusBreakdown", statusBreakdown);
        return result;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> getVendorPerformanceReport() {
        List<Vendor> vendors = vendorRepository.findAll();

        List<Map<String, Object>> vendorData = new ArrayList<>();
        for (Vendor vendor : vendors) {
            long quotationCount = quotationRepository.countByVendorId(vendor.getId());
            long approvedCount = approvalRepository.countByQuotationIdAndStatus(
                    vendor.getId(), ApprovalStatus.APPROVED);

            Map<String, Object> item = new HashMap<>();
            item.put("vendorId", vendor.getId());
            item.put("vendorName", vendor.getName());
            item.put("status", vendor.getStatus());
            item.put("quotationCount", quotationCount);
            item.put("category", "N/A");
            vendorData.add(item);
        }

        long activeVendors = vendors.stream().filter(v -> "ACTIVE".equals(v.getStatus())).count();
        long inactiveVendors = vendors.stream().filter(v -> "INACTIVE".equals(v.getStatus())).count();
        long blockedVendors = vendors.stream().filter(v -> "BLOCKED".equals(v.getStatus())).count();

        Map<String, Object> result = new HashMap<>();
        result.put("totalVendors", vendors.size());
        result.put("activeVendors", activeVendors);
        result.put("inactiveVendors", inactiveVendors);
        result.put("blockedVendors", blockedVendors);
        result.put("vendorData", vendorData);
        return result;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> getApprovalSummary() {
        List<Approval> all = approvalRepository.findAll();

        long total = all.size();
        long pending = all.stream().filter(a -> ApprovalStatus.PENDING == a.getStatus()).count();
        long approved = all.stream().filter(a -> ApprovalStatus.APPROVED == a.getStatus()).count();
        long rejected = all.stream().filter(a -> ApprovalStatus.REJECTED == a.getStatus()).count();

        BigDecimal totalAmount = all.stream()
                .map(Approval::getAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, Object> result = new HashMap<>();
        result.put("totalApprovals", total);
        result.put("pending", pending);
        result.put("approved", approved);
        result.put("rejected", rejected);
        result.put("totalAmount", totalAmount);
        result.put("approvalRate", total > 0 ?
                BigDecimal.valueOf(approved).divide(BigDecimal.valueOf(total), 4, java.math.RoundingMode.HALF_UP)
                        .multiply(BigDecimal.valueOf(100)) : BigDecimal.ZERO);
        return result;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> getCostSavingReport() {
        List<ProcurementRequest> requests = procurementRequestRepository.findAll();

        BigDecimal totalBudget = BigDecimal.ZERO;
        BigDecimal totalActual = BigDecimal.ZERO;
        int requestsWithQuotations = 0;

        for (ProcurementRequest req : requests) {
            if (req.getBudget() != null) {
                totalBudget = totalBudget.add(req.getBudget());
            }
            List<Quotation> quotations = quotationRepository
                    .findByPurchaseRequestIdAndStatus(req.getId(), QuotationStatus.VALIDATED);
            if (!quotations.isEmpty()) {
                BigDecimal minPrice = quotations.stream()
                        .map(Quotation::getTotalAmount)
                        .filter(Objects::nonNull)
                        .min(BigDecimal::compareTo)
                        .orElse(BigDecimal.ZERO);
                totalActual = totalActual.add(minPrice);
                requestsWithQuotations++;
            }
        }

        BigDecimal costSaving = totalBudget.subtract(totalActual);
        BigDecimal savingPercent = totalBudget.compareTo(BigDecimal.ZERO) > 0
                ? costSaving.divide(totalBudget, 4, java.math.RoundingMode.HALF_UP)
                        .multiply(BigDecimal.valueOf(100))
                : BigDecimal.ZERO;

        Map<String, Object> result = new HashMap<>();
        result.put("totalBudget", totalBudget);
        result.put("totalActual", totalActual);
        result.put("costSaving", costSaving);
        result.put("savingPercent", savingPercent);
        result.put("requestsWithQuotations", requestsWithQuotations);
        return result;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> getProcurementAnalytics() {
        List<ProcurementRequest> all = procurementRequestRepository.findAll();

        // Average processing time (days from creation to completion)
        long completedCount = 0;
        long totalDays = 0;
        for (ProcurementRequest req : all) {
            if (req.getStatus() == ProcurementStatus.COMPLETED && req.getCreatedAt() != null) {
                totalDays += ChronoUnit.DAYS.between(req.getCreatedAt(), req.getUpdatedAt() != null ? req.getUpdatedAt() : LocalDateTime.now());
                completedCount++;
            }
        }

        long avgProcessingDays = completedCount > 0 ? totalDays / completedCount : 0;

        // Quotation acceptance rate
        long totalQuotations = quotationRepository.count();
        long validatedQuotations = 0;
        for (Quotation q : quotationRepository.findAll()) {
            if (q.getStatus() == QuotationStatus.VALIDATED) validatedQuotations++;
        }

        Map<String, Object> result = new HashMap<>();
        result.put("totalProcurementRequests", all.size());
        result.put("averageProcessingDays", avgProcessingDays);
        result.put("totalQuotations", totalQuotations);
        result.put("validatedQuotations", validatedQuotations);
        result.put("quotationAcceptanceRate", totalQuotations > 0 ?
                BigDecimal.valueOf(validatedQuotations).divide(BigDecimal.valueOf(totalQuotations), 4, java.math.RoundingMode.HALF_UP)
                        .multiply(BigDecimal.valueOf(100)) : BigDecimal.ZERO);
        return result;
    }

    @Override
    public ReportResponse generateReport(String reportType, String reportName, UUID userId) {
        Report report = new Report();
        report.setReportType(reportType);
        report.setReportName(reportName);
        report.setDescription("Generated report: " + reportName);
        report.setFormat("JSON");
        report.setStatus("COMPLETED");
        report.setGeneratedBy(userId);

        // Calculate total records based on report type
        switch (reportType.toUpperCase()) {
            case "PROCUREMENT" -> report.setTotalRecords((long) procurementRequestRepository.count());
            case "QUOTATION" -> report.setTotalRecords((long) quotationRepository.count());
            case "VENDOR" -> report.setTotalRecords((long) vendorRepository.count());
            case "APPROVAL" -> report.setTotalRecords((long) approvalRepository.count());
            default -> report.setTotalRecords(0L);
        }

        Report saved = reportRepository.save(report);
        return toResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<ReportResponse> getReports(Pageable pageable) {
        return reportRepository.findAll(pageable).map(this::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<ReportResponse> getReportsByType(String reportType, Pageable pageable) {
        return reportRepository.findByReportType(reportType, pageable).map(this::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> getDashboardStats() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("procurement", getProcurementSummary());
        stats.put("quotation", getQuotationSummary());
        stats.put("vendor", getVendorPerformanceReport());
        stats.put("approval", getApprovalSummary());
        stats.put("costSaving", getCostSavingReport());
        stats.put("analytics", getProcurementAnalytics());
        return stats;
    }

    private ReportResponse toResponse(Report report) {
        ReportResponse response = new ReportResponse();
        response.setId(report.getId());
        response.setReportType(report.getReportType());
        response.setReportName(report.getReportName());
        response.setDescription(report.getDescription());
        response.setFormat(report.getFormat());
        response.setStatus(report.getStatus());
        response.setTotalRecords(report.getTotalRecords());
        response.setFilePath(report.getFilePath());
        response.setGeneratedBy(report.getGeneratedBy());
        response.setGeneratedAt(report.getGeneratedAt());
        response.setFilterParams(report.getFilterParams());
        return response;
    }
}
