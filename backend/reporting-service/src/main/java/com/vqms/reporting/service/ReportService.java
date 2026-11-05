package com.vqms.reporting.service;

import com.vqms.reporting.dto.request.ReportRequest;
import com.vqms.reporting.dto.response.PageResponse;
import com.vqms.reporting.dto.response.ReportResponse;
import com.vqms.reporting.enums.ReportType;
import org.springframework.data.domain.Pageable;

import java.util.UUID;

public interface ReportService {

    ReportResponse generate(ReportRequest request);

    ReportResponse get(UUID id);

    PageResponse<ReportResponse> list(ReportType type, Pageable pageable);

    String exportCsv(UUID id);
}
