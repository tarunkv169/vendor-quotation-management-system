package com.vqms.reporting.generator;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.vqms.reporting.client.PlatformApiClient;
import com.vqms.reporting.client.PlatformApiClient.Source;
import com.vqms.reporting.dto.request.ReportRequest;
import com.vqms.reporting.enums.ReportType;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * Approved spend per currency and vendor in a period, from the Approval Service (approved amount =
 * the authoritative quotation total that was approved). Amounts are summed with BigDecimal per currency;
 * different currencies are never added together.
 */
@Component
public class ApprovalSpendReportGenerator implements ReportGenerator {

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private final PlatformApiClient client;
    private final ObjectMapper mapper;

    public ApprovalSpendReportGenerator(PlatformApiClient client, ObjectMapper mapper) {
        this.client = client;
        this.mapper = mapper;
    }

    @Override
    public ReportType type() {
        return ReportType.APPROVAL_SPEND;
    }

    @Override
    public void validate(ReportRequest request) {
        PeriodReportSupport.validatePeriod(request, type().name());
    }

    private record Bucket(int count, BigDecimal total) {
        Bucket add(BigDecimal amount) {
            return new Bucket(count + 1, total.add(amount));
        }
    }

    @Override
    public GeneratedReport generate(ReportRequest r) {
        List<JsonNode> approved = client.getAll(Source.APPROVAL, "/api/v1/approvals", Map.of("status", "APPROVED"));
        Map<String, Map<String, Bucket>> byCurrencyVendor = new TreeMap<>();
        int rows = 0;
        for (JsonNode a : approved) {
            String currency = a.path("currencyCode").asText("");
            if (!PeriodReportSupport.inPeriod(a, "decidedAt", r.from(), r.to())
                    || (r.currencyCode() != null && !r.currencyCode().equals(currency)) || !a.hasNonNull("amount")) {
                continue;
            }
            BigDecimal amount = new BigDecimal(a.get("amount").asText());
            byCurrencyVendor.computeIfAbsent(currency, k -> new TreeMap<>())
                    .merge(a.path("vendorId").asText("UNKNOWN"), new Bucket(1, amount),
                            (x, y) -> new Bucket(x.count() + y.count(), x.total().add(y.total())));
            rows++;
        }

        ObjectNode root = mapper.createObjectNode().put("from", r.from().toString()).put("to", r.to().toString());
        if (r.currencyCode() != null) {
            root.put("currencyCode", r.currencyCode());
        }
        ArrayNode currencies = root.putArray("currencies");
        byCurrencyVendor.forEach((currency, vendors) -> {
            Bucket total = vendors.values().stream().reduce(new Bucket(0, BigDecimal.ZERO),
                    (x, y) -> new Bucket(x.count() + y.count(), x.total().add(y.total())));
            ObjectNode c = currencies.addObject().put("currencyCode", currency).put("approvals", total.count())
                    .put("totalAmount", total.total().setScale(2, RoundingMode.HALF_UP).toPlainString());
            ArrayNode vendorRows = c.putArray("vendors");
            vendors.entrySet().stream()
                    .sorted(Map.Entry.<String, Bucket>comparingByValue(Comparator.comparing(Bucket::total)).reversed())
                    .forEach(e -> vendorRows.addObject().put("vendorId", e.getKey())
                            .put("approvals", e.getValue().count())
                            .put("totalAmount", e.getValue().total().setScale(2, RoundingMode.HALF_UP).toPlainString())
                            .put("sharePercent", total.total().signum() == 0 ? "0.00" : e.getValue().total()
                                    .multiply(HUNDRED).divide(total.total(), 2, RoundingMode.HALF_UP).toPlainString()));
        });
        return new GeneratedReport(root, List.of(), rows);
    }

    @Override
    public List<List<String>> toRows(JsonNode data) {
        List<List<String>> rows = new ArrayList<>();
        rows.add(List.of("currencyCode", "vendorId", "approvals", "totalAmount", "sharePercent"));
        data.path("currencies").forEach(c -> c.path("vendors").forEach(v -> rows.add(List.of(
                c.path("currencyCode").asText(), v.path("vendorId").asText(), v.path("approvals").asText(),
                v.path("totalAmount").asText(), v.path("sharePercent").asText()))));
        return rows;
    }
}
