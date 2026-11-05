package com.vqms.validation.rules;

import com.vqms.validation.client.dto.QuotationItemData;
import com.vqms.validation.config.ValidationProperties;
import com.vqms.validation.dto.internal.IssueDraft;
import com.vqms.validation.dto.internal.ValidationContext;
import com.vqms.validation.enums.ValidationType;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/** FINANCIAL_VALIDATION: GST rates belong to the allowed slabs; discount rates are within range. */
@Component
public class TaxValidationRule implements ValidationRule {

    private static final ValidationType TYPE = ValidationType.FINANCIAL_VALIDATION;

    private final ValidationProperties properties;

    public TaxValidationRule(ValidationProperties properties) {
        this.properties = properties;
    }

    @Override
    public List<IssueDraft> validate(ValidationContext context) {
        List<IssueDraft> issues = new ArrayList<>();
        List<QuotationItemData> items = context.quotation().safeItems();
        for (int i = 0; i < items.size(); i++) {
            QuotationItemData item = items.get(i);
            BigDecimal tax = item.taxRate();
            if (tax != null && !properties.isAllowedTaxRate(tax)) {
                issues.add(IssueDraft.error(TYPE, "INVALID_TAX_RATE",
                        "Tax rate is not an allowed GST rate", "items[" + i + "].taxRate")
                        .withValues(properties.allowedTaxRates().toString(), tax.toPlainString()));
            }
            BigDecimal discount = item.discountRate();
            if (discount != null && (discount.signum() < 0 || discount.compareTo(properties.maxDiscountRate()) > 0)) {
                issues.add(IssueDraft.error(TYPE, "INVALID_DISCOUNT_RATE",
                        "Discount rate must be between 0 and " + properties.maxDiscountRate().toPlainString() + "%",
                        "items[" + i + "].discountRate")
                        .withValues("0.." + properties.maxDiscountRate().toPlainString(), discount.toPlainString()));
            }
        }
        return issues;
    }
}
