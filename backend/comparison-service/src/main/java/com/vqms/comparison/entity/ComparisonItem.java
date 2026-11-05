package com.vqms.comparison.entity;

import com.vqms.comparison.dto.internal.ComparisonCalculationResult.QuotationEvaluation;
import com.vqms.comparison.entity.base.BaseEntity;
import com.vqms.comparison.enums.ComparisonCriteria;
import com.vqms.comparison.enums.ComparisonResultType;
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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Result for one quotation inside a comparison: authoritative amounts, metrics,
 * per-criterion scores, overall score and rank.
 * {@code @JdbcTypeCode(SqlTypes.JSON)} stores maps/lists as PostgreSQL jsonb via Jackson.
 */
@Entity
@Table(name = "comparison_items")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ComparisonItem extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "comparison_id", nullable = false)
    private Comparison comparison;

    @Column(name = "quotation_id", nullable = false)
    private UUID quotationId;

    @Column(name = "vendor_id")
    private UUID vendorId;

    @Column(name = "quotation_number", length = 100)
    private String quotationNumber;

    @Column(name = "validation_id")
    private UUID validationId;

    @Enumerated(EnumType.STRING)
    @Column(name = "result_type", nullable = false, length = 20)
    private ComparisonResultType resultType;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "eligibility_reasons", columnDefinition = "jsonb")
    private List<String> eligibilityReasons;

    @Column(name = "currency_code", length = 3)
    private String currencyCode;

    @Column(name = "subtotal", precision = 19, scale = 4)
    private BigDecimal subtotal;

    @Column(name = "discount_amount", precision = 19, scale = 4)
    private BigDecimal discountAmount;

    @Column(name = "tax_amount", precision = 19, scale = 4)
    private BigDecimal taxAmount;

    @Column(name = "total_amount", precision = 19, scale = 4)
    private BigDecimal totalAmount;

    @Column(name = "max_delivery_days")
    private Integer maxDeliveryDays;

    @Column(name = "min_warranty_months")
    private Integer minWarrantyMonths;

    @Column(name = "item_coverage_percent", precision = 7, scale = 4)
    private BigDecimal itemCoveragePercent;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "criterion_scores", columnDefinition = "jsonb")
    private Map<ComparisonCriteria, BigDecimal> criterionScores;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "missing_criteria", columnDefinition = "jsonb")
    private List<ComparisonCriteria> missingCriteria;

    @Column(name = "overall_score", precision = 9, scale = 4)
    private BigDecimal overallScore;

    @Column(name = "rank_position")
    private Integer rankPosition;

    @Column(name = "lowest_price", nullable = false)
    private boolean lowestPrice;

    @Column(name = "difference_from_lowest", precision = 19, scale = 4)
    private BigDecimal differenceFromLowest;

    @Column(name = "difference_percent", precision = 9, scale = 4)
    private BigDecimal differencePercent;

    ComparisonItem(Comparison comparison, QuotationEvaluation e) {
        this.comparison = comparison;
        this.quotationId = e.quotationId();
        this.vendorId = e.vendorId();
        this.quotationNumber = e.quotationNumber();
        this.validationId = e.validationId();
        this.resultType = e.resultType();
        this.eligibilityReasons = List.copyOf(e.reasons());
        this.currencyCode = e.currencyCode();
        this.subtotal = e.subtotal();
        this.discountAmount = e.discountAmount();
        this.taxAmount = e.taxAmount();
        this.totalAmount = e.totalAmount();
        this.maxDeliveryDays = e.maxDeliveryDays();
        this.minWarrantyMonths = e.minWarrantyMonths();
        this.itemCoveragePercent = e.itemCoveragePercent();
        this.criterionScores = e.criterionScores();
        this.missingCriteria = List.copyOf(e.missingCriteria());
        this.overallScore = e.overallScore();
        this.rankPosition = e.rank();
        this.lowestPrice = e.lowestPrice();
        this.differenceFromLowest = e.differenceFromLowest();
        this.differencePercent = e.differencePercent();
    }
}
