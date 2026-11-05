package com.vqms.comparison.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Quotation as returned by the platform application (VendorQuotationApplication, {@code GET /api/v1/quotations/{id}}),
 * which is where quotations entered in the UI are stored. Converted to {@link QuotationDetails}, the shape the
 * comparison engine works with. Amounts are taken as returned; nothing is recalculated except the subtotal,
 * which the platform does not expose and is the sum of the returned line totals.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record PlatformQuotation(
        UUID id,
        UUID purchaseRequestId,
        UUID vendorId,
        String status,
        String currency,
        LocalDate validUntil,
        Integer version,
        BigDecimal totalAmount,
        BigDecimal taxAmount,
        BigDecimal discountAmount,
        Integer deliveryDays,
        String warrantyPeriod,
        List<Item> items
) {

    private static final Pattern NUMBER = Pattern.compile("(\\d+)");

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Item(UUID id, String itemName, Integer quantity, String unit, BigDecimal unitPrice,
                       BigDecimal lineTotal, Integer deliveryDays) {
    }

    public QuotationDetails toDetails() {
        List<Item> lines = items == null ? List.of() : items;
        Integer warrantyMonths = warrantyMonths(warrantyPeriod);
        List<QuotationDetails.Item> mapped = lines.stream()
                .map(line -> new QuotationDetails.Item(
                        line.id(),
                        null, // the platform does not link quotation lines to request items; matched by name
                        line.itemName(),
                        line.unit(),
                        line.quantity() == null ? null : BigDecimal.valueOf(line.quantity()),
                        line.unitPrice(),
                        null,
                        null,
                        line.lineTotal(),
                        line.deliveryDays() != null ? line.deliveryDays() : deliveryDays,
                        warrantyMonths))
                .toList();
        BigDecimal subtotal = lines.stream().map(Item::lineTotal).filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return new QuotationDetails(id, null, purchaseRequestId, vendorId, status, currency, validUntil,
                lines.isEmpty() ? null : subtotal, taxAmount, discountAmount, totalAmount, mapped,
                version == null ? null : version.longValue());
    }

    /** "12 months" -> 12, "2 years" -> 24, "1 yr" -> 12; null when no number is present. */
    static Integer warrantyMonths(String period) {
        if (period == null || period.isBlank()) {
            return null;
        }
        Matcher m = NUMBER.matcher(period);
        if (!m.find()) {
            return null;
        }
        int value = Integer.parseInt(m.group(1));
        String text = period.toLowerCase();
        return text.contains("year") || text.contains("yr") ? value * 12 : value;
    }
}
