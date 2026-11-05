package com.vqms.validation.service.internal;

import com.vqms.validation.dto.internal.IssueDraft;
import com.vqms.validation.dto.internal.ValidationContext;
import com.vqms.validation.dto.internal.ValidationResult;
import com.vqms.validation.rules.ValidationRule;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Runs every validation category over a fully loaded context. Pure computation: no I/O,
 * so it is deterministic and easy to reason about (and to unit test later).
 */
@Component
public class ValidationEngine {

    private final List<ValidationRule> rules;
    private final FinancialValidationService financialValidation;
    private final VendorValidationService vendorValidation;
    private final ItemValidationService itemValidation;
    private final BusinessRuleValidationService businessRuleValidation;
    private final DocumentValidationService documentValidation;

    public ValidationEngine(List<ValidationRule> rules,
                            FinancialValidationService financialValidation,
                            VendorValidationService vendorValidation,
                            ItemValidationService itemValidation,
                            BusinessRuleValidationService businessRuleValidation,
                            DocumentValidationService documentValidation) {
        this.rules = rules;
        this.financialValidation = financialValidation;
        this.vendorValidation = vendorValidation;
        this.itemValidation = itemValidation;
        this.businessRuleValidation = businessRuleValidation;
        this.documentValidation = documentValidation;
    }

    public ValidationResult run(ValidationContext context) {
        List<IssueDraft> issues = new ArrayList<>();
        rules.forEach(rule -> issues.addAll(rule.validate(context)));
        issues.addAll(vendorValidation.validate(context));
        issues.addAll(itemValidation.validate(context));
        issues.addAll(businessRuleValidation.validate(context));
        issues.addAll(documentValidation.validate(context));

        FinancialValidationService.FinancialCheck financial = financialValidation.validate(context.quotation());
        issues.addAll(financial.issues());
        return new ValidationResult(issues, financial.subtotal(), financial.discount(), financial.tax(),
                financial.total());
    }
}
