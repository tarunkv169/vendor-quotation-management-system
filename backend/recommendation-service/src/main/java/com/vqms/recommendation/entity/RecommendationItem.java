package com.vqms.recommendation.entity;

import com.vqms.recommendation.dto.internal.RecommendationCalculationResult.Evaluation;
import com.vqms.recommendation.dto.internal.RecommendationCalculationResult.RiskFactor;
import com.vqms.recommendation.entity.base.BaseEntity;
import com.vqms.recommendation.enums.RecommendationCriteria;
import com.vqms.recommendation.enums.RecommendationRole;
import com.vqms.recommendation.enums.RiskLevel;
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

/** Evaluation of one quotation within a recommendation (scores, risk and explanation are persisted). */
@Entity
@Table(name = "recommendation_items")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RecommendationItem extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "recommendation_id", nullable = false)
    private Recommendation recommendation;

    @Column(name = "quotation_id", nullable = false)
    private UUID quotationId;

    @Column(name = "vendor_id")
    private UUID vendorId;

    @Column(name = "eligible", nullable = false)
    private boolean eligible;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "eligibility_reasons", columnDefinition = "jsonb")
    private List<String> eligibilityReasons;

    @Enumerated(EnumType.STRING)
    @Column(name = "recommendation_role", nullable = false, length = 20)
    private RecommendationRole role;

    @Column(name = "total_amount", precision = 19, scale = 4)
    private BigDecimal totalAmount;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "criterion_scores", columnDefinition = "jsonb")
    private Map<RecommendationCriteria, BigDecimal> criterionScores;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "missing_criteria", columnDefinition = "jsonb")
    private List<RecommendationCriteria> missingCriteria;

    @Column(name = "overall_score", precision = 9, scale = 4)
    private BigDecimal overallScore;

    @Column(name = "rank_position")
    private Integer rankPosition;

    @Enumerated(EnumType.STRING)
    @Column(name = "risk_level", nullable = false, length = 20)
    private RiskLevel riskLevel;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "risk_factors", columnDefinition = "jsonb")
    private List<RiskFactor> riskFactors;

    @Column(name = "explanation", columnDefinition = "text")
    private String explanation;

    RecommendationItem(Recommendation recommendation, Evaluation e) {
        this.recommendation = recommendation;
        this.quotationId = e.quotationId();
        this.vendorId = e.vendorId();
        this.eligible = e.eligible();
        this.eligibilityReasons = List.copyOf(e.eligibilityReasons());
        this.role = e.role();
        this.totalAmount = e.totalAmount();
        this.criterionScores = e.criterionScores();
        this.missingCriteria = List.copyOf(e.missingCriteria());
        this.overallScore = e.overallScore();
        this.rankPosition = e.rank();
        this.riskLevel = e.riskLevel();
        this.riskFactors = List.copyOf(e.riskFactors());
        this.explanation = e.explanation();
    }
}
