package com.vqms.recommendation.entity;

import com.vqms.recommendation.dto.internal.RecommendationCalculationResult;
import com.vqms.recommendation.entity.base.BaseEntity;
import com.vqms.recommendation.enums.RecommendationCriteria;
import com.vqms.recommendation.enums.RecommendationStatus;
import com.vqms.recommendation.enums.RecommendationType;
import com.vqms.recommendation.enums.RiskLevel;
import com.vqms.recommendation.exception.InvalidRecommendationException;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import lombok.AccessLevel;
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
 * An explainable recommendation for one completed comparison. It never approves or rejects:
 * the strongest action is "submit for approval", which hands the decision to the Approval Service.
 */
@Entity
@Table(name = "recommendations")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Recommendation extends BaseEntity {

    @Column(name = "recommendation_number", nullable = false, length = 40, unique = true)
    private String recommendationNumber;

    @Column(name = "procurement_request_id", nullable = false)
    private UUID procurementRequestId;

    @Column(name = "comparison_id", nullable = false)
    private UUID comparisonId;

    @Column(name = "comparison_number", length = 40)
    private String comparisonNumber;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private RecommendationStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "recommendation_type", nullable = false, length = 40)
    private RecommendationType type;

    @Column(name = "policy_code", nullable = false, length = 40)
    private String policyCode;

    @Column(name = "currency_code", length = 3)
    private String currencyCode;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "criteria_weights", nullable = false, columnDefinition = "jsonb")
    private Map<RecommendationCriteria, BigDecimal> criteriaWeights;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "excluded_criteria", columnDefinition = "jsonb")
    private List<RecommendationCriteria> excludedCriteria;

    @Column(name = "recommended_quotation_id")
    private UUID recommendedQuotationId;

    @Column(name = "recommended_vendor_id")
    private UUID recommendedVendorId;

    @Column(name = "overall_score", precision = 9, scale = 4)
    private BigDecimal overallScore;

    @Enumerated(EnumType.STRING)
    @Column(name = "risk_level", length = 20)
    private RiskLevel riskLevel;

    @Column(name = "requires_review", nullable = false)
    private boolean requiresReview;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "review_reasons", columnDefinition = "jsonb")
    private List<String> reviewReasons;

    @Column(name = "explanation", columnDefinition = "text")
    private String explanation;

    @Column(name = "previous_recommendation_id")
    private UUID previousRecommendationId;

    @Column(name = "source_event_id")
    private UUID sourceEventId;

    @Column(name = "generated_by")
    private UUID generatedBy;

    @Column(name = "generated_at", nullable = false)
    private Instant generatedAt;

    @Column(name = "submitted_by")
    private UUID submittedBy;

    @Column(name = "submitted_at")
    private Instant submittedAt;

    @Column(name = "submission_comment", length = 1000)
    private String submissionComment;

    @OneToMany(mappedBy = "recommendation", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("rankPosition ASC")
    private List<RecommendationItem> items = new ArrayList<>();

    public Recommendation(String recommendationNumber, UUID procurementRequestId, UUID comparisonId,
                          String comparisonNumber, String policyCode, String currencyCode,
                          UUID previousRecommendationId, UUID sourceEventId, UUID generatedBy,
                          RecommendationCalculationResult result) {
        this.recommendationNumber = recommendationNumber;
        this.procurementRequestId = procurementRequestId;
        this.comparisonId = comparisonId;
        this.comparisonNumber = comparisonNumber;
        this.policyCode = policyCode;
        this.currencyCode = currencyCode;
        this.previousRecommendationId = previousRecommendationId;
        this.sourceEventId = sourceEventId;
        this.generatedBy = generatedBy;
        this.type = result.type();
        this.criteriaWeights = result.weights();
        this.excludedCriteria = List.copyOf(result.excludedCriteria());
        this.recommendedQuotationId = result.recommendedQuotationId();
        this.recommendedVendorId = result.recommendedVendorId();
        this.overallScore = result.overallScore();
        this.riskLevel = result.riskLevel();
        this.requiresReview = result.requiresReview();
        this.reviewReasons = List.copyOf(result.reviewReasons());
        this.explanation = result.explanation();
        this.status = result.requiresReview() ? RecommendationStatus.NEEDS_REVIEW : RecommendationStatus.GENERATED;
        this.generatedAt = Instant.now();
        result.evaluations().forEach(e -> items.add(new RecommendationItem(this, e)));
    }

    public void supersede() {
        if (status == RecommendationStatus.SUBMITTED_FOR_APPROVAL) {
            throw new InvalidRecommendationException("A recommendation submitted for approval cannot be regenerated");
        }
        if (status == RecommendationStatus.SUPERSEDED) {
            throw new InvalidRecommendationException("Recommendation is already superseded");
        }
        this.status = RecommendationStatus.SUPERSEDED;
    }

    /**
     * Hands the recommendation to the Approval Service. Review points must be explicitly
     * acknowledged; a recommendation without a recommended vendor can never be submitted.
     */
    public void submitForApproval(UUID userId, String comment, boolean reviewAcknowledged) {
        if (status != RecommendationStatus.GENERATED && status != RecommendationStatus.NEEDS_REVIEW) {
            throw new InvalidRecommendationException("Recommendation in status " + status + " cannot be submitted");
        }
        if (recommendedQuotationId == null) {
            throw new InvalidRecommendationException("No vendor is recommended; a manual decision is required");
        }
        if (requiresReview && !reviewAcknowledged) {
            throw new InvalidRecommendationException(
                    "Recommendation has open review points; set reviewAcknowledged=true with a comment to submit");
        }
        if (requiresReview && (comment == null || comment.isBlank())) {
            throw new InvalidRecommendationException("A comment is required when submitting with open review points");
        }
        this.status = RecommendationStatus.SUBMITTED_FOR_APPROVAL;
        this.submittedBy = userId;
        this.submittedAt = Instant.now();
        this.submissionComment = comment;
    }

    public List<RecommendationItem> getItems() {
        return Collections.unmodifiableList(items);
    }
}
