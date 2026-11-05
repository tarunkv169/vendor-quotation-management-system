package com.vqms.validation.dto.internal;

import com.vqms.validation.enums.ValidationSeverity;
import com.vqms.validation.enums.ValidationType;

/** A finding produced by a rule before it is persisted as a ValidationIssue. */
public record IssueDraft(
        ValidationType type,
        String code,
        ValidationSeverity severity,
        String message,
        String fieldPath,
        String expectedValue,
        String actualValue
) {

    public static IssueDraft error(ValidationType type, String code, String message, String fieldPath) {
        return new IssueDraft(type, code, ValidationSeverity.ERROR, message, fieldPath, null, null);
    }

    public static IssueDraft warning(ValidationType type, String code, String message, String fieldPath) {
        return new IssueDraft(type, code, ValidationSeverity.WARNING, message, fieldPath, null, null);
    }

    public static IssueDraft info(ValidationType type, String code, String message, String fieldPath) {
        return new IssueDraft(type, code, ValidationSeverity.INFO, message, fieldPath, null, null);
    }

    public IssueDraft withValues(Object expected, Object actual) {
        return new IssueDraft(type, code, severity, message, fieldPath,
                expected == null ? null : String.valueOf(expected), actual == null ? null : String.valueOf(actual));
    }
}
