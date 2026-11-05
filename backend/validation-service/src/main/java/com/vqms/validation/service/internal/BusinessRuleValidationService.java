package com.vqms.validation.service.internal;

import com.vqms.validation.client.dto.ProcurementRequestData;
import com.vqms.validation.client.dto.QuotationData;
import com.vqms.validation.client.dto.QuotationItemData;
import com.vqms.validation.client.dto.QuotationSummaryData;
import com.vqms.validation.config.ValidationProperties;
import com.vqms.validation.dto.internal.IssueDraft;
import com.vqms.validation.dto.internal.ValidationContext;
import com.vqms.validation.enums.ValidationType;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Currency;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

/**
 * PROCUREMENT_VALIDATION and BUSINESS_RULE_VALIDATION:
 * procurement request exists and accepts quotations, currency code, validity dates,
 * delivery before the required date, and duplicate submissions by the same vendor.
 */
@Service
public class BusinessRuleValidationService {

    private static final ValidationType PROCUREMENT = ValidationType.PROCUREMENT_VALIDATION;
    private static final ValidationType BUSINESS = ValidationType.BUSINESS_RULE_VALIDATION;

    private final ValidationProperties properties;

    public BusinessRuleValidationService(ValidationProperties properties) {
        this.properties = properties;
    }

    public List<IssueDraft> validate(ValidationContext context) {
        List<IssueDraft> issues = new ArrayList<>();
        QuotationData q = context.quotation();
        validateProcurement(context, issues);
        validateCurrency(q, issues);
        validateDates(q, context.today(), issues);
        validateDelivery(context, issues);
        validateDuplicates(context, issues);
        return issues;
    }

    private void validateProcurement(ValidationContext context, List<IssueDraft> issues) {
        if (context.quotation().procurementRequestId() == null) {
            return;
        }
        if (context.procurementRequest().isEmpty()) {
            issues.add(IssueDraft.error(PROCUREMENT, "PROCUREMENT_REQUEST_NOT_FOUND",
                    "Procurement request does not exist", "procurementRequestId")
                    .withValues(null, context.quotation().procurementRequestId()));
            return;
        }
        String status = context.procurementRequest().get().status();
        if (status == null || !properties.openProcurementStatuses().contains(status.toUpperCase(Locale.ROOT))) {
            issues.add(IssueDraft.error(PROCUREMENT, "PROCUREMENT_REQUEST_CLOSED",
                    "Procurement request is not accepting quotations", "procurementRequestId")
                    .withValues(properties.openProcurementStatuses().toString(), status));
        }
    }

    private void validateCurrency(QuotationData q, List<IssueDraft> issues) {
        if (!StringUtils.hasText(q.currencyCode())) {
            return;
        }
        String code = q.currencyCode().trim().toUpperCase(Locale.ROOT);
        try {
            Currency.getInstance(code);
        } catch (IllegalArgumentException ex) {
            issues.add(IssueDraft.error(BUSINESS, "INVALID_CURRENCY", "Currency code is not a valid ISO-4217 code",
                    "currencyCode").withValues("ISO-4217", q.currencyCode()));
            return;
        }
        if (properties.allowedCurrencies() != null && !properties.allowedCurrencies().isEmpty()
                && !properties.allowedCurrencies().contains(code)) {
            issues.add(IssueDraft.error(BUSINESS, "CURRENCY_NOT_ALLOWED", "Currency is not accepted",
                    "currencyCode").withValues(properties.allowedCurrencies().toString(), code));
        }
    }

    private void validateDates(QuotationData q, LocalDate today, List<IssueDraft> issues) {
        if (q.issueDate() != null && q.issueDate().isAfter(today)) {
            issues.add(IssueDraft.error(BUSINESS, "ISSUE_DATE_IN_FUTURE", "Issue date is in the future", "issueDate")
                    .withValues("<= " + today, q.issueDate()));
        }
        if (q.validUntil() != null) {
            if (q.validUntil().isBefore(today)) {
                issues.add(IssueDraft.error(BUSINESS, "QUOTATION_EXPIRED", "Quotation validity has expired",
                        "validUntil").withValues(">= " + today, q.validUntil()));
            }
            if (q.issueDate() != null && q.validUntil().isBefore(q.issueDate())) {
                issues.add(IssueDraft.error(BUSINESS, "INVALID_VALIDITY_PERIOD",
                        "Validity date is before the issue date", "validUntil")
                        .withValues(">= " + q.issueDate(), q.validUntil()));
            }
        }
    }

    private void validateDelivery(ValidationContext context, List<IssueDraft> issues) {
        LocalDate requiredBy = context.procurementRequest()
                .map(ProcurementRequestData::requiredBy)
                .map(dateTime -> dateTime.toLocalDate())
                .orElse(null);
        if (requiredBy == null) {
            return;
        }
        List<QuotationItemData> items = context.quotation().safeItems();
        for (int i = 0; i < items.size(); i++) {
            Integer days = items.get(i).deliveryDays();
            if (days != null && context.today().plusDays(days).isAfter(requiredBy)) {
                issues.add(IssueDraft.warning(BUSINESS, "DELIVERY_AFTER_REQUIRED_DATE",
                        "Delivery lead time ends after the required date", "items[" + i + "].deliveryDays")
                        .withValues("<= " + requiredBy, context.today().plusDays(days)));
            }
        }
    }

    private void validateDuplicates(ValidationContext context, List<IssueDraft> issues) {
        QuotationData q = context.quotation();
        for (QuotationSummaryData other : context.otherQuotationsForRequest()) {
            boolean sameVendor = Objects.equals(other.vendorId(), q.vendorId());
            boolean differentQuotation = !Objects.equals(other.id(), q.id());
            boolean active = other.status() != null
                    && properties.activeQuotationStatuses().contains(other.status().toUpperCase(Locale.ROOT));
            if (sameVendor && differentQuotation && active) {
                issues.add(IssueDraft.error(BUSINESS, "DUPLICATE_SUBMISSION",
                        "Vendor already has an active quotation for this procurement request", "quotationId")
                        .withValues(null, other.quotationNumber() != null ? other.quotationNumber() : other.id()));
            }
        }
    }
}
