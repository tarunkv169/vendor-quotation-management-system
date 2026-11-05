package com.vqms.validation.rules;

import com.vqms.validation.client.dto.QuotationData;
import com.vqms.validation.client.dto.QuotationItemData;
import com.vqms.validation.dto.internal.IssueDraft;
import com.vqms.validation.dto.internal.ValidationContext;
import com.vqms.validation.enums.ValidationType;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;

/** STRUCTURAL_VALIDATION: mandatory quotation and line fields are present. */
@Component
public class RequiredFieldRule implements ValidationRule {

    private static final ValidationType TYPE = ValidationType.STRUCTURAL_VALIDATION;

    @Override
    public List<IssueDraft> validate(ValidationContext context) {
        QuotationData q = context.quotation();
        List<IssueDraft> issues = new ArrayList<>();

        if (!StringUtils.hasText(q.quotationNumber())) {
            issues.add(IssueDraft.error(TYPE, "QUOTATION_NUMBER_MISSING", "Quotation number is missing", "quotationNumber"));
        }
        if (q.vendorId() == null) {
            issues.add(IssueDraft.error(TYPE, "VENDOR_MISSING", "Quotation has no vendor", "vendorId"));
        }
        if (q.procurementRequestId() == null) {
            issues.add(IssueDraft.error(TYPE, "PROCUREMENT_REQUEST_MISSING",
                    "Quotation is not linked to a procurement request", "procurementRequestId"));
        }
        if (!StringUtils.hasText(q.currencyCode())) {
            issues.add(IssueDraft.error(TYPE, "CURRENCY_MISSING", "Currency code is missing", "currencyCode"));
        }
        if (q.validUntil() == null) {
            issues.add(IssueDraft.warning(TYPE, "VALIDITY_DATE_MISSING", "Quotation validity date is missing",
                    "validUntil"));
        }
        if (q.safeItems().isEmpty()) {
            issues.add(IssueDraft.error(TYPE, "NO_ITEMS", "Quotation has no line items", "items"));
        }
        for (int i = 0; i < q.safeItems().size(); i++) {
            QuotationItemData item = q.safeItems().get(i);
            String path = "items[" + i + "]";
            if (!StringUtils.hasText(item.itemName())) {
                issues.add(IssueDraft.error(TYPE, "ITEM_NAME_MISSING", "Item name is missing", path + ".itemName"));
            }
            if (!StringUtils.hasText(item.unit())) {
                issues.add(IssueDraft.error(TYPE, "UNIT_MISSING", "Unit of measure is missing", path + ".unit"));
            }
            if (item.quantity() == null) {
                issues.add(IssueDraft.error(TYPE, "QUANTITY_MISSING", "Quantity is missing", path + ".quantity"));
            }
            if (item.unitPrice() == null) {
                issues.add(IssueDraft.error(TYPE, "UNIT_PRICE_MISSING", "Unit price is missing", path + ".unitPrice"));
            }
            if (item.taxRate() == null) {
                issues.add(IssueDraft.warning(TYPE, "TAX_RATE_MISSING", "Tax rate is missing (treated as 0%)",
                        path + ".taxRate"));
            }
        }
        return issues;
    }
}
