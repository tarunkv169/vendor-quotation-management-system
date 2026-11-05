package com.vqms.validation.service.internal;

import com.vqms.validation.client.dto.QuotationData;
import com.vqms.validation.client.dto.QuotationItemData;
import com.vqms.validation.config.ValidationProperties;
import com.vqms.validation.dto.internal.IssueDraft;
import com.vqms.validation.enums.ValidationType;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Currency;
import java.util.List;

/**
 * Independently recalculates every amount with the same formula and rounding policy as the
 * Quotation Service and reports differences. Values are never overwritten.
 *
 * <pre>
 * gross     = quantity x unitPrice                      (scale 4, HALF_UP)
 * discount  = gross x discountRate / 100                (scale 4, HALF_UP)
 * taxable   = gross - discount
 * tax       = taxable x taxRate / 100                   (scale 4, HALF_UP)
 * lineTotal = taxable + tax
 * subtotal  = sum(gross); totals = sums of the line values
 * </pre>
 * Comparison: both sides are rounded to the currency's minor units (e.g. 2 for INR, 0 for JPY);
 * a difference larger than the configured tolerance is an ERROR.
 */
@Service
public class FinancialValidationService {

    private static final ValidationType TYPE = ValidationType.FINANCIAL_VALIDATION;
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);
    private static final RoundingMode MODE = ValidationProperties.ROUNDING_MODE;

    private final ValidationProperties properties;

    public FinancialValidationService(ValidationProperties properties) {
        this.properties = properties;
    }

    public record FinancialCheck(List<IssueDraft> issues, BigDecimal subtotal, BigDecimal discount,
                                 BigDecimal tax, BigDecimal total) {
    }

    public FinancialCheck validate(QuotationData quotation) {
        int scale = properties.calculationScale();
        int currencyScale = currencyScale(quotation.currencyCode());
        List<IssueDraft> issues = new ArrayList<>();

        BigDecimal subtotal = zero(scale);
        BigDecimal totalDiscount = zero(scale);
        BigDecimal totalTax = zero(scale);
        BigDecimal total = zero(scale);
        boolean complete = true;

        List<QuotationItemData> items = quotation.safeItems();
        for (int i = 0; i < items.size(); i++) {
            QuotationItemData item = items.get(i);
            if (item.quantity() == null || item.unitPrice() == null) {
                complete = false;
                continue;
            }
            BigDecimal discountRate = item.discountRate() == null ? BigDecimal.ZERO : item.discountRate();
            BigDecimal taxRate = item.taxRate() == null ? BigDecimal.ZERO : item.taxRate();

            BigDecimal gross = item.quantity().multiply(item.unitPrice()).setScale(scale, MODE);
            BigDecimal discount = gross.multiply(discountRate).divide(HUNDRED, scale, MODE);
            BigDecimal taxable = gross.subtract(discount).setScale(scale, MODE);
            BigDecimal tax = taxable.multiply(taxRate).divide(HUNDRED, scale, MODE);
            BigDecimal lineTotal = taxable.add(tax).setScale(scale, MODE);

            String path = "items[" + i + "]";
            compare(issues, "LINE_DISCOUNT_MISMATCH", "Line discount amount", path + ".discountAmount",
                    discount, item.discountAmount(), currencyScale);
            compare(issues, "LINE_TAX_MISMATCH", "Line tax amount", path + ".taxAmount",
                    tax, item.taxAmount(), currencyScale);
            compare(issues, "LINE_TOTAL_MISMATCH", "Line total", path + ".lineTotal",
                    lineTotal, item.lineTotal(), currencyScale);

            subtotal = subtotal.add(gross);
            totalDiscount = totalDiscount.add(discount);
            totalTax = totalTax.add(tax);
            total = total.add(lineTotal);
        }

        if (complete && !items.isEmpty()) {
            compare(issues, "SUBTOTAL_MISMATCH", "Quotation subtotal", "subtotal",
                    subtotal, quotation.subtotal(), currencyScale);
            compare(issues, "DISCOUNT_TOTAL_MISMATCH", "Quotation discount", "discountAmount",
                    totalDiscount, quotation.discountAmount(), currencyScale);
            compare(issues, "TAX_TOTAL_MISMATCH", "Quotation tax", "taxAmount",
                    totalTax, quotation.taxAmount(), currencyScale);
            compare(issues, "TOTAL_MISMATCH", "Quotation total", "totalAmount",
                    total, quotation.totalAmount(), currencyScale);
            if (total.signum() <= 0) {
                issues.add(IssueDraft.error(TYPE, "NON_POSITIVE_TOTAL", "Quotation total must be positive",
                        "totalAmount").withValues("> 0", total.toPlainString()));
            }
            return new FinancialCheck(issues, subtotal, totalDiscount, totalTax, total);
        }
        return new FinancialCheck(issues, null, null, null, null);
    }

    private void compare(List<IssueDraft> issues, String code, String label, String path,
                         BigDecimal expected, BigDecimal actual, int currencyScale) {
        BigDecimal expectedRounded = expected.setScale(currencyScale, MODE);
        if (actual == null) {
            issues.add(IssueDraft.warning(TYPE, code.replace("MISMATCH", "MISSING"),
                    label + " is missing in the quotation", path).withValues(expectedRounded.toPlainString(), null));
            return;
        }
        BigDecimal actualRounded = actual.setScale(currencyScale, MODE);
        if (expectedRounded.subtract(actualRounded).abs().compareTo(properties.amountTolerance()) > 0) {
            issues.add(IssueDraft.error(TYPE, code,
                    label + " does not match the recalculated amount", path)
                    .withValues(expectedRounded.toPlainString(), actualRounded.toPlainString()));
        }
    }

    /** Minor units of the currency (INR/USD 2, JPY 0); 2 when unknown. */
    public static int currencyScale(String currencyCode) {
        try {
            int digits = Currency.getInstance(currencyCode).getDefaultFractionDigits();
            return digits < 0 ? 2 : digits;
        } catch (RuntimeException ex) {
            return 2;
        }
    }

    private static BigDecimal zero(int scale) {
        return BigDecimal.ZERO.setScale(scale, MODE);
    }
}
