package com.vqms.reporting.controller;

import com.vqms.reporting.constants.ReportingConstants;
import com.vqms.reporting.dto.request.ReportRequest;
import com.vqms.reporting.dto.response.PageResponse;
import com.vqms.reporting.dto.response.ReportResponse;
import com.vqms.reporting.enums.ReportType;
import com.vqms.reporting.service.ReportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

/** Reporting API for procurement staff. Data access is still limited by each source service. */
@RestController
@RequestMapping(ReportingConstants.API_BASE_PATH)
@PreAuthorize("hasAnyRole('ADMIN','PROCUREMENT_ADMIN','PROCUREMENT_MANAGER')")
@Tag(name = "Reports")
public class ReportController {

    private final ReportService reportService;

    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    @PostMapping
    @Operation(summary = "Generate a report (stored as a snapshot)")
    public ResponseEntity<ReportResponse> generate(@Valid @RequestBody ReportRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(reportService.generate(request));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a stored report with its data")
    public ResponseEntity<ReportResponse> get(@PathVariable UUID id) {
        return ResponseEntity.ok(reportService.get(id));
    }

    @GetMapping
    @Operation(summary = "List generated reports (newest first)")
    public ResponseEntity<PageResponse<ReportResponse>> list(@RequestParam(required = false) ReportType type,
                                                             @ParameterObject @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(reportService.list(type, pageable));
    }

    @GetMapping(value = "/{id}/export", produces = "text/csv")
    @Operation(summary = "Export a stored report as CSV")
    public ResponseEntity<String> export(@PathVariable UUID id) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename("report-" + id + ".csv", StandardCharsets.UTF_8).build().toString())
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .body(reportService.exportCsv(id));
    }
}
