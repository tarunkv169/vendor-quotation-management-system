package com.vqms.comparison.service.internal;

import com.vqms.comparison.client.dto.ProcurementRequestDetails;
import com.vqms.comparison.client.dto.QuotationDetails;
import com.vqms.comparison.config.ComparisonProperties;
import com.vqms.comparison.constants.ComparisonConstants;
import com.vqms.comparison.entity.json.LineComparison;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

/** Item-wise comparison: coverage of requested items, unit/quantity compatibility and unit prices. */
@Service
public class ItemComparisonService {

    private final int scale;

    public ItemComparisonService(ComparisonProperties properties) {
        this.scale = properties.scoreScale();
    }

    /**
     * Percentage (0-100) of requested items quoted with the requested unit and at least the requested quantity.
     * Null when the procurement request has no items (no basis for technical compliance).
     */
    public BigDecimal coveragePercent(ProcurementRequestDetails request, QuotationDetails quotation) {
        List<ProcurementRequestDetails.Item> requested = request.safeItems();
        if (requested.isEmpty()) {
            return null;
        }
        long covered = requested.stream().filter(item -> isCovered(item, quotation)).count();
        return BigDecimal.valueOf(covered).multiply(ComparisonConstants.HUNDRED)
                .divide(BigDecimal.valueOf(requested.size()), scale, ComparisonProperties.ROUNDING);
    }

    private static boolean isCovered(ProcurementRequestDetails.Item requested, QuotationDetails quotation) {
        return quotation.safeItems().stream()
                .filter(line -> belongsTo(line, requested))
                .anyMatch(line -> unitMatches(requested.unit(), line.unit())
                        && (requested.quantity() == null
                        || (line.quantity() != null && line.quantity().compareTo(requested.quantity()) >= 0)));
    }

    public List<LineComparison> compareLines(ProcurementRequestDetails request, List<QuotationDetails> quotations) {
        List<LineComparison> result = new ArrayList<>();
        for (ProcurementRequestDetails.Item requested : request.safeItems()) {
            List<LineComparison.LineQuote> quotes = new ArrayList<>();
            for (QuotationDetails quotation : quotations) {
                quotation.safeItems().stream()
                        .filter(line -> belongsTo(line, requested))
                        .findFirst()
                        .ifPresent(line -> quotes.add(new LineComparison.LineQuote(quotation.id(), quotation.vendorId(),
                                line.unit(), line.quantity(), line.unitPrice(), line.taxRate(), line.discountRate(),
                                line.lineTotal(), unitMatches(requested.unit(), line.unit()))));
            }
            LineComparison.LineQuote lowest = quotes.stream()
                    .filter(LineComparison.LineQuote::comparable)
                    .filter(q -> q.unitPrice() != null && q.unitPrice().signum() > 0)
                    .min(Comparator.comparing(LineComparison.LineQuote::unitPrice))
                    .orElse(null);
            result.add(new LineComparison(requested.id(), requested.description(), requested.unit(),
                    requested.quantity(), quotes, lowest == null ? null : lowest.quotationId(),
                    lowest == null ? null : lowest.unitPrice()));
        }
        return result;
    }

    /**
     * A quotation line belongs to a requested item when it references the item's id. Lines without a reference
     * (quotations entered in the platform UI) are matched by name: same text, ignoring case and spacing.
     */
    static boolean belongsTo(QuotationDetails.Item line, ProcurementRequestDetails.Item requested) {
        if (line.procurementItemId() != null) {
            return Objects.equals(line.procurementItemId(), requested.id());
        }
        return normalize(line.itemName()) != null && normalize(line.itemName()).equals(normalize(requested.description()));
    }

    private static String normalize(String text) {
        return text == null || text.isBlank() ? null : text.trim().replaceAll("\\s+", " ").toLowerCase();
    }

    static boolean unitMatches(String requested, String quoted) {
        return requested == null || (quoted != null && requested.trim().equalsIgnoreCase(quoted.trim()));
    }
}
