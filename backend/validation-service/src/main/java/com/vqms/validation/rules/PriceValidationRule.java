package com.vqms.validation.rules;

import com.vqms.validation.client.dto.ProcurementRequestData;
import com.vqms.validation.client.dto.QuotationItemData;
import com.vqms.validation.config.ValidationProperties;
import com.vqms.validation.dto.internal.IssueDraft;
import com.vqms.validation.dto.internal.ValidationContext;
import com.vqms.validation.enums.ValidationType;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * FINANCIAL_VALIDATION: unit prices are non-negative, non-zero and close to the procurement
 * request's expected price (deviation above the configured percentage needs review).
 */
@Component
public class PriceValidationRule implements ValidationRule {

    private static final ValidationType TYPE = ValidationType.FINANCIAL_VALIDATION;
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private final ValidationProperties properties;

    public PriceValidationRule(ValidationProperties properties) {
        this.properties = properties;
    }

    @Override
    public List<IssueDraft> validate(ValidationContext context) {
        List<IssueDraft> issues = new ArrayList<>();
        Map<UUID, ProcurementRequestData.Item> requested = context.procurementRequest()
                .map(pr -> pr.safeItems().stream()
                        .filter(item -> item.id() != null)
                        .collect(Collectors.toMap(ProcurementRequestData.Item::id, Function.identity(), (a, b) -> a)))
                .orElse(Map.of());

        List<QuotationItemData> items = context.quotation().safeItems();
        for (int i = 0; i < items.size(); i++) {
            QuotationItemData item = items.get(i);
            BigDecimal price = item.unitPrice();
            if (price == null) {
                continue;
            }
            String path = "items[" + i + "].unitPrice";
            if (price.signum() < 0) {
                issues.add(IssueDraft.error(TYPE, "NEGATIVE_UNIT_PRICE", "Unit price must not be negative", path)
                        .withValues(">= 0", price.toPlainString()));
                continue;
            }
            if (price.signum() == 0) {
                issues.add(IssueDraft.warning(TYPE, "ZERO_UNIT_PRICE", "Unit price is zero", path));
                continue;
            }
            ProcurementRequestData.Item reference = item.procurementItemId() == null
                    ? null : requested.get(item.procurementItemId());
            if (reference != null && reference.expectedUnitPrice() != null
                    && reference.expectedUnitPrice().signum() > 0) {
                BigDecimal expected = reference.expectedUnitPrice();
                BigDecimal deviationPercent = price.subtract(expected).abs()
                        .multiply(HUNDRED)
                        .divide(expected, 2, RoundingMode.HALF_UP);
                if (deviationPercent.compareTo(properties.priceDeviationWarningPercent()) > 0) {
                    issues.add(IssueDraft.warning(TYPE, "PRICE_DEVIATION",
                            "Unit price deviates " + deviationPercent.toPlainString()
                                    + "% from the expected price", path)
                            .withValues(expected.toPlainString(), price.toPlainString()));
                }
            }
        }
        return issues;
    }
}
