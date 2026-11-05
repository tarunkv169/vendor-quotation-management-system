package com.vqms.controller;

import com.vqms.dto.response.ReportResponse;
import com.vqms.service.ReportingService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/reports")
@RequiredArgsConstructor
public class ReportingController {

    private final ReportingService reportingService;

    @GetMapping("/procurement/summary")
    public ResponseEntity<Map<String, Object>> getProcurementSummary() {
        return ResponseEntity.ok(reportingService.getProcurementSummary());
    }

    @GetMapping("/procurement/range")
    public ResponseEntity<Map<String, Object>> getProcurementByDateRange(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate end) {
        return ResponseEntity.ok(reportingService.getProcurementReportByDateRange(start, end));
    }

    @GetMapping("/quotation/summary")
    public ResponseEntity<Map<String, Object>> getQuotationSummary() {
        return ResponseEntity.ok(reportingService.getQuotationSummary());
    }

    @GetMapping("/quotation/range")
    public ResponseEntity<Map<String, Object>> getQuotationByDateRange(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate end) {
        return ResponseEntity.ok(reportingService.getQuotationReportByDateRange(start, end));
    }

    @GetMapping("/vendor/performance")
    public ResponseEntity<Map<String, Object>> getVendorPerformance() {
        return ResponseEntity.ok(reportingService.getVendorPerformanceReport());
    }

    @GetMapping("/approval/summary")
    public ResponseEntity<Map<String, Object>> getApprovalSummary() {
        return ResponseEntity.ok(reportingService.getApprovalSummary());
    }

    @GetMapping("/cost-saving")
    public ResponseEntity<Map<String, Object>> getCostSaving() {
        return ResponseEntity.ok(reportingService.getCostSavingReport());
    }

    @GetMapping("/analytics")
    public ResponseEntity<Map<String, Object>> getAnalytics() {
        return ResponseEntity.ok(reportingService.getProcurementAnalytics());
    }

    @GetMapping("/dashboard")
    public ResponseEntity<Map<String, Object>> getDashboardStats() {
        return ResponseEntity.ok(reportingService.getDashboardStats());
    }

    @PostMapping("/generate")
    public ResponseEntity<ReportResponse> generateReport(
            @RequestBody Map<String, String> request,
            @RequestHeader(value = "X-User-Id", required = false) UUID userId) {
        String reportType = request.get("reportType");
        String reportName = request.get("reportName");
        if (reportType == null || reportName == null) {
            return ResponseEntity.badRequest().build();
        }
        ReportResponse response = reportingService.generateReport(
                reportType, reportName, userId != null ? userId : UUID.randomUUID());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<Page<ReportResponse>> getReports(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("generatedAt").descending());
        return ResponseEntity.ok(reportingService.getReports(pageable));
    }

    @GetMapping("/type/{type}")
    public ResponseEntity<Page<ReportResponse>> getReportsByType(
            @PathVariable String type,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("generatedAt").descending());
        return ResponseEntity.ok(reportingService.getReportsByType(type, pageable));
    }
}
