package com.vqms.validation.entity;

import com.vqms.validation.entity.base.BaseEntity;
import com.vqms.validation.enums.ValidationSeverity;
import com.vqms.validation.enums.ValidationType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * One finding of a validation run. {@code expectedValue}/{@code actualValue} hold the
 * recalculated vs. quoted values so discrepancies are reported, never silently corrected.
 */
@Entity
@Table(name = "validation_issues")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ValidationIssue extends BaseEntity {

    /** Same-service relationship (allowed); LAZY avoids loading the parent unnecessarily. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "validation_record_id", nullable = false)
    private ValidationRecord validationRecord;

    @Enumerated(EnumType.STRING)
    @Column(name = "validation_type", nullable = false, length = 40)
    private ValidationType validationType;

    @Column(name = "issue_code", nullable = false, length = 60)
    private String issueCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "severity", nullable = false, length = 10)
    private ValidationSeverity severity;

    @Column(name = "message", nullable = false, length = 1000)
    private String message;

    @Column(name = "field_path", length = 200)
    private String fieldPath;

    @Column(name = "expected_value", length = 255)
    private String expectedValue;

    @Column(name = "actual_value", length = 255)
    private String actualValue;

    ValidationIssue(ValidationRecord record, ValidationType type, String issueCode, ValidationSeverity severity,
                    String message, String fieldPath, String expectedValue, String actualValue) {
        this.validationRecord = record;
        this.validationType = type;
        this.issueCode = issueCode;
        this.severity = severity;
        this.message = truncate(message, 1000);
        this.fieldPath = truncate(fieldPath, 200);
        this.expectedValue = truncate(expectedValue, 255);
        this.actualValue = truncate(actualValue, 255);
    }

    private static String truncate(String value, int max) {
        return value == null || value.length() <= max ? value : value.substring(0, max);
    }
}
