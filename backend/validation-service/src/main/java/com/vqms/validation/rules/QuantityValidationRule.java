package com.vqms.validation.rules;

import com.vqms.validation.client.dto.QuotationItemData;
import com.vqms.validation.dto.internal.IssueDraft;
import com.vqms.validation.dto.internal.ValidationContext;
import com.vqms.validation.enums.ValidationType;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/** ITEM_VALIDATION: quantities are positive and have a sensible precision. */
@Component
public class QuantityValidationRule implements ValidationRule {

    private static final ValidationType TYPE = ValidationType.ITEM_VALIDATION;
    private static final int MAX_QUANTITY_SCALE = 3;

    @Override
    public List<IssueDraft> validate(ValidationContext context) {
        List<IssueDraft> issues = new ArrayList<>();
        List<QuotationItemData> items = context.quotation().safeItems();
        for (int i = 0; i < items.size(); i++) {
            BigDecimal quantity = items.get(i).quantity();
            if (quantity == null) {
                continue; // reported by RequiredFieldRule
            }
            String path = "items[" + i + "].quantity";
            if (quantity.signum() <= 0) {
                issues.add(IssueDraft.error(TYPE, "INVALID_QUANTITY", "Quantity must be greater than zero", path)
                        .withValues("> 0", quantity.toPlainString()));
            } else if (quantity.stripTrailingZeros().scale() > MAX_QUANTITY_SCALE) {
                issues.add(IssueDraft.warning(TYPE, "QUANTITY_PRECISION",
                        "Quantity has more than " + MAX_QUANTITY_SCALE + " decimal places", path)
                        .withValues(null, quantity.toPlainString()));
            }
        }
        return issues;
    }
}
