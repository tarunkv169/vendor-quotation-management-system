package com.vqms.reporting.generator;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.vqms.reporting.client.PlatformApiClient;
import com.vqms.reporting.client.PlatformApiClient.Source;
import com.vqms.reporting.dto.request.ReportRequest;
import com.vqms.reporting.enums.ReportType;
import com.vqms.reporting.exception.ExternalServiceUnavailableException;
import com.vqms.reporting.exception.InvalidReportRequestException;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Supplier;

/**
 * End-to-end lifecycle of one procurement request. Each section comes from its owning service;
 * an unavailable service yields a warning and an "available: false" section instead of failing.
 */
@Component
public class ProcurementSummaryReportGenerator implements ReportGenerator {

    private final PlatformApiClient client;
    private final ObjectMapper mapper;

    public ProcurementSummaryReportGenerator(PlatformApiClient client, ObjectMapper mapper) {
        this.client = client;
        this.mapper = mapper;
    }

    @Override
    public ReportType type() {
        return ReportType.PROCUREMENT_SUMMARY;
    }

    @Override
    public void validate(ReportRequest request) {
        if (request.procurementRequestId() == null) {
            throw new InvalidReportRequestException("procurementRequestId is required for PROCUREMENT_SUMMARY");
        }
    }

    @Override
    public GeneratedReport generate(ReportRequest request) {
        UUID id = request.procurementRequestId();
        List<String> warnings = new ArrayList<>();
        ObjectNode root = mapper.createObjectNode().put("procurementRequestId", id.toString());

        List<JsonNode> quotations = section(warnings, "Quotation", () ->
                client.getAll(Source.QUOTATION, "/api/v1/quotations/procurement-request/{id}", Map.of(), id));
        List<JsonNode> validations = section(warnings, "Validation", () ->
                client.getAll(Source.VALIDATION, "/api/v1/validations", Map.of("procurementRequestId", id)));
        List<JsonNode> comparisons = section(warnings, "Comparison", () ->
                client.getAll(Source.COMPARISON, "/api/v1/comparisons/procurement-request/{id}", Map.of(), id));
        List<JsonNode> recommendations = section(warnings, "Recommendation", () ->
                client.getAll(Source.RECOMMENDATION, "/api/v1/recommendations/procurement-request/{id}", Map.of(), id));
        List<JsonNode> approvals = section(warnings, "Approval", () ->
                client.getAll(Source.APPROVAL, "/api/v1/approvals", Map.of("procurementRequestId", id)));

        // Latest validation per quotation (validation lists are newest first).
        Map<String, JsonNode> latestValidation = new HashMap<>();
        if (validations != null) {
            validations.forEach(v -> latestValidation.putIfAbsent(v.path("quotationId").asText(), v));
        }
        ArrayNode quotationRows = root.putArray("quotations");
        if (quotations != null) {
            for (JsonNode q : quotations) {
                JsonNode v = latestValidation.get(q.path("id").asText());
                quotationRows.addObject()
                        .put("quotationId", q.path("id").asText())
                        .put("quotationNumber", q.path("quotationNumber").asText(null))
                        .put("vendorId", q.path("vendorId").asText(null))
                        .put("status", q.path("status").asText(null))
                        .put("currencyCode", q.path("currencyCode").asText(null))
                        .put("totalAmount", q.path("totalAmount").asText(null))
                        .put("latestValidationStatus", v == null ? null : v.path("status").asText(null));
            }
        } else {
            root.put("quotationsAvailable", false);
        }

        JsonNode comparison = comparisons == null || comparisons.isEmpty() ? null : comparisons.get(0);
        if (comparison != null) {
            ObjectNode c = root.putObject("latestComparison");
            copy(comparison, c, "id", "comparisonNumber", "status", "currencyCode", "lowestQuotationId",
                    "recommendedQuotationId", "eligibleCount", "requiresReview");
            String status = comparison.path("status").asText();
            if ("CALCULATED".equals(status) || "COMPLETED".equals(status)) {
                try {
                    client.get(Source.COMPARISON, b -> b.path("/api/v1/comparisons/{id}/ranking")
                            .build(comparison.path("id").asText())).ifPresent(r -> c.set("ranking", r));
                } catch (ExternalServiceUnavailableException ex) {
                    warnings.add("Comparison ranking unavailable");
                }
            }
        }
        JsonNode recommendation = recommendations == null ? null : recommendations.stream()
                .filter(r -> !"SUPERSEDED".equals(r.path("status").asText())).findFirst().orElse(null);
        if (recommendation != null) {
            copy(recommendation, root.putObject("currentRecommendation"), "id", "recommendationNumber", "status",
                    "type", "recommendedQuotationId", "recommendedVendorId", "overallScore", "riskLevel",
                    "requiresReview");
        }
        ArrayNode approvalRows = root.putArray("approvals");
        if (approvals != null) {
            approvals.forEach(a -> copy(a, approvalRows.addObject(), "id", "approvalNumber", "status", "amount",
                    "currencyCode", "quotationId", "policyCode", "decidedAt"));
        }
        root.put("stage", stage(quotations, validations, comparison, recommendation, approvals));
        return new GeneratedReport(root, warnings, quotationRows.size());
    }

    /** Most advanced lifecycle stage reached by the request. */
    private static String stage(List<JsonNode> quotations, List<JsonNode> validations, JsonNode comparison,
                                JsonNode recommendation, List<JsonNode> approvals) {
        if (approvals != null && approvals.stream().anyMatch(a -> "APPROVED".equals(a.path("status").asText()))) {
            return "APPROVED";
        }
        if (approvals != null && approvals.stream().anyMatch(a -> a.path("status").asText().matches("PENDING|IN_PROGRESS"))) {
            return "IN_APPROVAL";
        }
        if (recommendation != null) {
            return "RECOMMENDED";
        }
        if (comparison != null) {
            return "COMPARED";
        }
        if (validations != null && !validations.isEmpty()) {
            return "VALIDATED";
        }
        return quotations != null && !quotations.isEmpty() ? "QUOTATIONS_RECEIVED" : "NO_QUOTATIONS";
    }

    @Override
    public List<List<String>> toRows(JsonNode data) {
        List<List<String>> rows = new ArrayList<>();
        rows.add(List.of("quotationNumber", "vendorId", "status", "currencyCode", "totalAmount", "latestValidationStatus"));
        data.path("quotations").forEach(q -> rows.add(List.of(q.path("quotationNumber").asText(""),
                q.path("vendorId").asText(""), q.path("status").asText(""), q.path("currencyCode").asText(""),
                q.path("totalAmount").asText(""), q.path("latestValidationStatus").asText(""))));
        return rows;
    }

    private static List<JsonNode> section(List<String> warnings, String name, Supplier<List<JsonNode>> loader) {
        try {
            return loader.get();
        } catch (ExternalServiceUnavailableException ex) {
            warnings.add(name + " Service unavailable - section omitted");
            return null;
        }
    }

    private static void copy(JsonNode from, ObjectNode to, String... fields) {
        for (String f : fields) {
            if (from.hasNonNull(f)) {
                to.set(f, from.get(f));
            }
        }
    }
}
