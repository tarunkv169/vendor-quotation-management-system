package com.vqms.validation.mapper;

import com.vqms.validation.dto.response.ValidationIssueResponse;
import com.vqms.validation.dto.response.ValidationResponse;
import com.vqms.validation.entity.ValidationIssue;
import com.vqms.validation.entity.ValidationRecord;
import org.springframework.stereotype.Component;

/** Entity -> response mapping (explicit, so internal fields such as the snapshot are never exposed). */
@Component
public class ValidationMapper {

    public ValidationResponse toResponse(ValidationRecord r, boolean includeIssues) {
        return new ValidationResponse(
                r.getId(), r.getQuotationId(), r.getQuotationNumber(), r.getQuotationVersion(), r.getVendorId(),
                r.getProcurementRequestId(), r.getExtractionId(), r.getDocumentId(), r.getStatus(), r.getTrigger(),
                r.getPreviousValidationId(), r.getCurrencyCode(), r.getExpectedSubtotal(), r.getExpectedDiscount(),
                r.getExpectedTax(), r.getExpectedTotal(), r.getQuotedTotal(), r.getErrorCount(),
                r.getWarningCount(), r.getInfoCount(), r.getSummary(), r.getValidatedAt(), r.getCreatedAt(),
                includeIssues ? r.getIssues().stream().map(this::toIssueResponse).toList() : null);
    }

    public ValidationIssueResponse toIssueResponse(ValidationIssue i) {
        return new ValidationIssueResponse(i.getId(), i.getValidationType(), i.getIssueCode(), i.getSeverity(),
                i.getMessage(), i.getFieldPath(), i.getExpectedValue(), i.getActualValue());
    }
}
