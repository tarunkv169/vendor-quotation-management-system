package com.vqms.reporting.generator;

import com.fasterxml.jackson.databind.JsonNode;
import com.vqms.reporting.dto.request.ReportRequest;
import com.vqms.reporting.enums.ReportType;

import java.util.List;

/** One report type. Generators are discovered as Spring beans and selected by {@link #type()}. */
public interface ReportGenerator {

    ReportType type();

    /** Validates parameters; throws InvalidReportRequestException when they are incomplete. */
    void validate(ReportRequest request);

    GeneratedReport generate(ReportRequest request);

    /** Flat rows (first row = header) for CSV export of a stored report. */
    List<List<String>> toRows(JsonNode data);

    record GeneratedReport(JsonNode data, List<String> warnings, int rowCount) {
    }
}
