package com.vqms.comparison.entity;

import com.vqms.comparison.dto.internal.ComparisonCalculationResult;
import com.vqms.comparison.entity.base.BaseEntity;
import com.vqms.comparison.entity.json.LineComparison;
import com.vqms.comparison.entity.json.ManualScore;
import com.vqms.comparison.enums.ComparisonCriteria;
import com.vqms.comparison.enums.ComparisonStatus;
import com.vqms.comparison.exception.InvalidComparisonException;
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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * A comparison of the eligible quotations of one procurement request, with its own
 * procurement-specific criteria weights (summing to 100). Quotations and vendors are
 * referenced by UUID only (owned by other services).
 */
@Entity
@Table(name = "comparisons")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Comparison extends BaseEntity {

    @Column(name = "comparison_number", nullable = false, length = 40, unique = true)
    private String comparisonNumber;

    @Column(name = "procurement_request_id", nullable = false)
    private UUID procurementRequestId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private ComparisonStatus status;

    /** Requested currency, or the single currency found among the quotations after calculation. */
    @Column(name = "currency_code", length = 3)
    private String currencyCode;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "criteria_weights", nullable = false, columnDefinition = "jsonb")
    private Map<ComparisonCriteria, BigDecimal> criteriaWeights;

    /** Optional eligibility thresholds: a quotation scoring below the minimum is excluded. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "minimum_scores", columnDefinition = "jsonb")
    private Map<ComparisonCriteria, BigDecimal> minimumScores;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "manual_scores", columnDefinition = "jsonb")
    private List<ManualScore> manualScores;

    /** Optional subset of quotations to compare; empty = all quotations of the request. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "requested_quotation_ids", columnDefinition = "jsonb")
    private List<UUID> requestedQuotationIds;

    /** Mandatory technical requirement: every requested item must be quoted in full. */
    @Column(name = "require_all_items", nullable = false)
    private boolean requireAllItems;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "excluded_criteria", columnDefinition = "jsonb")
    private List<ComparisonCriteria> excludedCriteria;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "line_comparisons", columnDefinition = "jsonb")
    private List<LineComparison> lineComparisons;

    @Column(name = "requires_review", nullable = false)
    private boolean requiresReview;

    /** Set when a validation event arrives after calculation: results may be outdated. */
    @Column(name = "stale", nullable = false)
    private boolean stale;

    @Column(name = "eligible_count", nullable = false)
    private int eligibleCount;

    @Column(name = "lowest_quotation_id")
    private UUID lowestQuotationId;

    /** Filled from the Recommendation Service's event; never decided here. */
    @Column(name = "recommended_quotation_id")
    private UUID recommendedQuotationId;

    @Column(name = "failure_reason", length = 1000)
    private String failureReason;

    @Column(name = "created_by", nullable = false)
    private UUID createdBy;

    @Column(name = "calculated_at")
    private Instant calculatedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @OneToMany(mappedBy = "comparison", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("rankPosition ASC") // PostgreSQL sorts NULLs (unranked) last for ASC
    private List<ComparisonItem> items = new ArrayList<>();

    @Builder
    private Comparison(String comparisonNumber, UUID procurementRequestId, String currencyCode,
                       Map<ComparisonCriteria, BigDecimal> criteriaWeights,
                       Map<ComparisonCriteria, BigDecimal> minimumScores, List<ManualScore> manualScores,
                       List<UUID> requestedQuotationIds, boolean requireAllItems, UUID createdBy) {
        this.comparisonNumber = comparisonNumber;
        this.procurementRequestId = procurementRequestId;
        this.currencyCode = currencyCode;
        this.criteriaWeights = criteriaWeights;
        this.minimumScores = minimumScores;
        this.manualScores = manualScores;
        this.requestedQuotationIds = requestedQuotationIds;
        this.requireAllItems = requireAllItems;
        this.createdBy = createdBy;
        this.status = ComparisonStatus.CREATED;
    }

    /** Replaces previous results with a new calculation. */
    public void applyCalculation(ComparisonCalculationResult result) {
        assertCalculable();
        items.clear();
        result.evaluations().forEach(e -> items.add(new ComparisonItem(this, e)));
        this.currencyCode = result.currencyCode();
        this.excludedCriteria = List.copyOf(result.excludedCriteria());
        this.lineComparisons = List.copyOf(result.lineComparisons());
        this.requiresReview = result.requiresReview();
        this.eligibleCount = result.eligibleCount();
        this.lowestQuotationId = result.lowestQuotationId();
        this.failureReason = null;
        this.stale = false;
        this.status = ComparisonStatus.CALCULATED;
        this.calculatedAt = Instant.now();
    }

    public void markFailed(String reason) {
        assertCalculable();
        this.status = ComparisonStatus.FAILED;
        this.failureReason = reason;
        this.calculatedAt = Instant.now();
    }

    public void complete() {
        if (status != ComparisonStatus.CALCULATED) {
            throw new InvalidComparisonException("Only CALCULATED comparisons can be completed (current: " + status + ")");
        }
        if (stale) {
            throw new InvalidComparisonException("Comparison is stale; recalculate before completing");
        }
        this.status = ComparisonStatus.COMPLETED;
        this.completedAt = Instant.now();
    }

    public void markStale() {
        if (status == ComparisonStatus.CALCULATED) {
            this.stale = true;
        }
    }

    public void setRecommendedQuotation(UUID quotationId) {
        this.recommendedQuotationId = quotationId;
    }

    private void assertCalculable() {
        if (!status.canCalculate()) {
            throw new InvalidComparisonException("A COMPLETED comparison cannot be recalculated");
        }
    }

    public List<ComparisonItem> getItems() {
        return Collections.unmodifiableList(items);
    }
}
