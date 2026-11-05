package com.vqms.validation.entity;

import com.vqms.validation.dto.internal.IssueDraft;
import com.vqms.validation.entity.base.BaseEntity;
import com.vqms.validation.enums.ValidationSeverity;
import com.vqms.validation.enums.ValidationStatus;
import com.vqms.validation.enums.ValidationTrigger;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

/**
 * One validation run of a quotation (history is kept: revalidation creates a new record
 * linked through {@code previousValidationId}). Other services are referenced by UUID only.
 */
@Entity
@Table(name = "validation_records")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ValidationRecord extends BaseEntity {

    @Column(name = "quotation_id")
    private UUID quotationId;

    @Column(name = "quotation_number", length = 100)
    private String quotationNumber;

    /** Quotation Service entity version that was validated (detects stale results). */
    @Column(name = "quotation_version")
    private Long quotationVersion;

    @Column(name = "vendor_id")
    private UUID vendorId;

    @Column(name = "procurement_request_id")
    private UUID procurementRequestId;

    @Column(name = "extraction_id")
    private UUID extractionId;

    @Column(name = "document_id")
    private UUID documentId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private ValidationStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "validation_trigger", nullable = false, length = 30)
    private ValidationTrigger trigger;

    @Column(name = "requested_by")
    private UUID requestedBy;

    @Column(name = "previous_validation_id")
    private UUID previousValidationId;

    @Column(name = "source_event_id")
    private UUID sourceEventId;

    @Column(name = "currency_code", length = 3)
    private String currencyCode;

    @Column(name = "expected_subtotal", precision = 19, scale = 4)
    private BigDecimal expectedSubtotal;

    @Column(name = "expected_discount", precision = 19, scale = 4)
    private BigDecimal expectedDiscount;

    @Column(name = "expected_tax", precision = 19, scale = 4)
    private BigDecimal expectedTax;

    @Column(name = "expected_total", precision = 19, scale = 4)
    private BigDecimal expectedTotal;

    @Column(name = "quoted_total", precision = 19, scale = 4)
    private BigDecimal quotedTotal;

    @Column(name = "error_count", nullable = false)
    private int errorCount;

    @Column(name = "warning_count", nullable = false)
    private int warningCount;

    @Column(name = "info_count", nullable = false)
    private int infoCount;

    @Column(name = "summary", length = 500)
    private String summary;

    /** JSON of the extraction payload, kept so a revalidation can repeat document checks. */
    @Column(name = "extraction_snapshot", columnDefinition = "text")
    private String extractionSnapshot;

    @Column(name = "validated_at")
    private Instant validatedAt;

    @OneToMany(mappedBy = "validationRecord", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("createdAt ASC")
    private List<ValidationIssue> issues = new ArrayList<>();

    @Builder
    private ValidationRecord(UUID quotationId, String quotationNumber, Long quotationVersion, UUID vendorId,
                             UUID procurementRequestId, UUID extractionId, UUID documentId,
                             ValidationTrigger trigger, UUID requestedBy, UUID previousValidationId,
                             UUID sourceEventId, String currencyCode, String extractionSnapshot) {
        this.quotationId = quotationId;
        this.quotationNumber = quotationNumber;
        this.quotationVersion = quotationVersion;
        this.vendorId = vendorId;
        this.procurementRequestId = procurementRequestId;
        this.extractionId = extractionId;
        this.documentId = documentId;
        this.trigger = trigger;
        this.requestedBy = requestedBy;
        this.previousValidationId = previousValidationId;
        this.sourceEventId = sourceEventId;
        this.currencyCode = currencyCode;
        this.extractionSnapshot = extractionSnapshot;
        this.status = ValidationStatus.IN_PROGRESS;
    }

    /** Adds the findings, applies the status rule and stamps the run as complete. */
    public void complete(List<IssueDraft> drafts, BigDecimal expectedSubtotal, BigDecimal expectedDiscount,
                         BigDecimal expectedTax, BigDecimal expectedTotal, BigDecimal quotedTotal) {
        for (IssueDraft d : drafts) {
            issues.add(new ValidationIssue(this, d.type(), d.code(), d.severity(), d.message(), d.fieldPath(),
                    d.expectedValue(), d.actualValue()));
        }
        this.errorCount = (int) drafts.stream().filter(d -> d.severity() == ValidationSeverity.ERROR).count();
        this.warningCount = (int) drafts.stream().filter(d -> d.severity() == ValidationSeverity.WARNING).count();
        this.infoCount = (int) drafts.stream().filter(d -> d.severity() == ValidationSeverity.INFO).count();
        this.status = ValidationStatus.fromCounts(errorCount, warningCount);
        this.expectedSubtotal = expectedSubtotal;
        this.expectedDiscount = expectedDiscount;
        this.expectedTax = expectedTax;
        this.expectedTotal = expectedTotal;
        this.quotedTotal = quotedTotal;
        this.summary = String.format("%s: %d error(s), %d warning(s), %d info", status, errorCount, warningCount,
                infoCount);
        this.validatedAt = Instant.now();
    }

    public List<ValidationIssue> getIssues() {
        return Collections.unmodifiableList(issues);
    }
}
