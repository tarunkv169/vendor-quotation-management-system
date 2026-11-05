package com.vqms.validation.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Quotation as returned by the platform application (VendorQuotationApplication, {@code GET /api/v1/quotations/{id}}),
 * which stores the quotations entered in the UI. Converted to {@link QuotationData}, the shape the validation rules use.
 *
 * <p>Mapping notes:
 * <ul>
 *   <li>The platform does not record the vendor's own quotation number; its reference {@code Q-<first 8 id chars>}
 *       is used as the quotation number.</li>
 *   <li>Lines carry no link to procurement items and no tax/discount rates (the platform stores tax and discount
 *       per quotation); those fields stay empty, which the rules report as warnings.</li>
 *   <li>The subtotal is the sum of the returned line totals; all other amounts are taken as returned.</li>
 * </ul>
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record PlatformQuotation(
        UUID id,
        UUID purchaseRequestId,
        UUID vendorId,
        String status,
        String currency,
        LocalDate quotationDate,
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
    public record Item(UUID id, String itemName, String description, Integer quantity, String unit,
                       BigDecimal unitPrice, BigDecimal lineTotal, Integer deliveryDays) {
    }

    /** Platform reference used as the quotation number, e.g. "Q-81558E8D". */
    public String reference() {
        return id == null ? null : "Q-" + id.toString().substring(0, 8).toUpperCase(Locale.ROOT);
    }

    public QuotationData toData() {
        List<Item> lines = items == null ? List.of() : items;
        Integer warrantyMonths = warrantyMonths(warrantyPeriod);
        List<QuotationItemData> mapped = lines.stream()
                .map(line -> new QuotationItemData(
                        line.id(), null, line.itemName(), line.description(), line.unit(),
                        line.quantity() == null ? null : BigDecimal.valueOf(line.quantity()),
                        line.unitPrice(), null, null, null, null, line.lineTotal(),
                        line.deliveryDays() != null ? line.deliveryDays() : deliveryDays,
                        warrantyMonths))
                .toList();
        BigDecimal subtotal = lines.stream().map(Item::lineTotal).filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return new QuotationData(id, reference(), purchaseRequestId, vendorId, status, currency, quotationDate,
                validUntil, lines.isEmpty() ? null : subtotal, taxAmount, discountAmount, totalAmount, mapped,
                version == null ? null : version.longValue());
    }

    public QuotationSummaryData toSummary() {
        return new QuotationSummaryData(id, reference(), vendorId, status);
    }

    /** "12 months" -> 12, "2 years" -> 24; null when no number is present. */
    static Integer warrantyMonths(String period) {
        if (period == null || period.isBlank()) {
            return null;
        }
        Matcher m = NUMBER.matcher(period);
        if (!m.find()) {
            return null;
        }
        int value = Integer.parseInt(m.group(1));
        String text = period.toLowerCase(Locale.ROOT);
        return text.contains("year") || text.contains("yr") ? value * 12 : value;
    }
}
