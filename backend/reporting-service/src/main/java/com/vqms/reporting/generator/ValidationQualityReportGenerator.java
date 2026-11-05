package com.vqms.reporting.generator;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.vqms.reporting.client.PlatformApiClient;
import com.vqms.reporting.client.PlatformApiClient.Source;
import com.vqms.reporting.dto.request.ReportRequest;
import com.vqms.reporting.enums.ReportType;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/** Validation outcomes in a period: counts per status and trigger, pass rate, average issues per run. */
@Component
public class ValidationQualityReportGenerator implements ReportGenerator {

    private final PlatformApiClient client;
    private final ObjectMapper mapper;

    public ValidationQualityReportGenerator(PlatformApiClient client, ObjectMapper mapper) {
        this.client = client;
        this.mapper = mapper;
    }

    @Override
    public ReportType type() {
        return ReportType.VALIDATION_QUALITY;
    }

    @Override
    public void validate(ReportRequest request) {
        PeriodReportSupport.validatePeriod(request, type().name());
    }

    @Override
    public GeneratedReport generate(ReportRequest r) {
        List<JsonNode> runs = client.getAll(Source.VALIDATION, "/api/v1/validations", Map.of()).stream()
                .filter(v -> PeriodReportSupport.inPeriod(v, "createdAt", r.from(), r.to()))
                .toList();
        Map<String, Integer> byStatus = new TreeMap<>();
        Map<String, Integer> byTrigger = new TreeMap<>();
        long errors = 0;
        long warnings = 0;
        for (JsonNode v : runs) {
            byStatus.merge(v.path("status").asText("UNKNOWN"), 1, Integer::sum);
            byTrigger.merge(v.path("trigger").asText("UNKNOWN"), 1, Integer::sum);
            errors += v.path("errorCount").asLong(0);
            warnings += v.path("warningCount").asLong(0);
        }
        int total = runs.size();
        ObjectNode root = mapper.createObjectNode().put("from", r.from().toString()).put("to", r.to().toString())
                .put("validations", total)
                .put("passRatePercent", rate(byStatus.getOrDefault("PASSED", 0), total))
                .put("averageErrorsPerRun", average(errors, total))
                .put("averageWarningsPerRun", average(warnings, total));
        ObjectNode statuses = root.putObject("byStatus");
        byStatus.forEach(statuses::put);
        ObjectNode triggers = root.putObject("byTrigger");
        byTrigger.forEach(triggers::put);
        return new GeneratedReport(root, List.of(), total);
    }

    private static String rate(int part, int total) {
        return total == 0 ? "0.00" : BigDecimal.valueOf(part).multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(total), 2, RoundingMode.HALF_UP).toPlainString();
    }

    private static String average(long sum, int total) {
        return total == 0 ? "0.00" : BigDecimal.valueOf(sum)
                .divide(BigDecimal.valueOf(total), 2, RoundingMode.HALF_UP).toPlainString();
    }

    @Override
    public List<List<String>> toRows(JsonNode data) {
        List<List<String>> rows = new ArrayList<>();
        rows.add(List.of("metric", "value"));
        rows.add(List.of("validations", data.path("validations").asText()));
        rows.add(List.of("passRatePercent", data.path("passRatePercent").asText()));
        rows.add(List.of("averageErrorsPerRun", data.path("averageErrorsPerRun").asText()));
        rows.add(List.of("averageWarningsPerRun", data.path("averageWarningsPerRun").asText()));
        data.path("byStatus").fields().forEachRemaining(e -> rows.add(List.of("status." + e.getKey(), e.getValue().asText())));
        data.path("byTrigger").fields().forEachRemaining(e -> rows.add(List.of("trigger." + e.getKey(), e.getValue().asText())));
        return rows;
    }
}
