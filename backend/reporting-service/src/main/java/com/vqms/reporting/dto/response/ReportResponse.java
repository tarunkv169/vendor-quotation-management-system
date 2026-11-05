package com.vqms.reporting.dto.response;

import com.fasterxml.jackson.databind.JsonNode;
import com.vqms.reporting.enums.ReportStatus;
import com.vqms.reporting.enums.ReportType;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Report snapshot; {@code data} is omitted in list responses. */
public record ReportResponse(UUID id, String reportNumber, ReportType reportType, ReportStatus status,
                             Map<String, String> parameters, JsonNode data, List<String> warnings, int rowCount,
                             String failureReason, UUID generatedBy, Instant generatedAt, long durationMs) {
}
