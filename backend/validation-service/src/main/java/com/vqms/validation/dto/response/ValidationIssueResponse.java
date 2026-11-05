package com.vqms.validation.dto.response;

import com.vqms.validation.enums.ValidationSeverity;
import com.vqms.validation.enums.ValidationType;

import java.util.UUID;

public record ValidationIssueResponse(
        UUID id,
        ValidationType validationType,
        String issueCode,
        ValidationSeverity severity,
        String message,
        String fieldPath,
        String expectedValue,
        String actualValue
) {
}
