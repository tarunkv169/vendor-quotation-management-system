package com.vqms.recommendation.event;

import com.vqms.recommendation.config.CorrelationIdFilter;
import com.vqms.recommendation.config.MessagingProperties;
import com.vqms.recommendation.constants.RecommendationConstants;
import com.vqms.recommendation.entity.Recommendation;
import com.vqms.recommendation.entity.RecommendationItem;
import com.vqms.recommendation.enums.RecommendationRole;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** Writes recommendation events to the transactional outbox (call inside the business transaction). */
@Component
public class RecommendationEventPublisher {

    private final OutboxService outboxService;
    private final MessagingProperties properties;

    public RecommendationEventPublisher(OutboxService outboxService, MessagingProperties properties) {
        this.outboxService = outboxService;
        this.properties = properties;
    }

    public void publishGenerated(Recommendation r) {
        UUID eventId = UUID.randomUUID();
        enqueue(eventId, r, RecommendationConstants.EVENT_GENERATED, new RecommendationGeneratedEvent(eventId,
                RecommendationConstants.EVENT_GENERATED, Instant.now(), CorrelationIdFilter.currentOrNew(), r.getId(),
                r.getRecommendationNumber(), r.getComparisonId(), r.getProcurementRequestId(), r.getType().name(),
                r.getRecommendedQuotationId(), r.getRecommendedVendorId(), r.getOverallScore(), risk(r),
                r.isRequiresReview()));
    }

    public void publishRegenerated(Recommendation r) {
        UUID eventId = UUID.randomUUID();
        enqueue(eventId, r, RecommendationConstants.EVENT_REGENERATED, new RecommendationRegeneratedEvent(eventId,
                RecommendationConstants.EVENT_REGENERATED, Instant.now(), CorrelationIdFilter.currentOrNew(), r.getId(),
                r.getRecommendationNumber(), r.getPreviousRecommendationId(), r.getComparisonId(),
                r.getProcurementRequestId(), r.getType().name(), r.getRecommendedQuotationId(),
                r.getRecommendedVendorId(), r.getOverallScore(), risk(r), r.isRequiresReview()));
    }

    public void publishSubmittedForApproval(Recommendation r) {
        UUID eventId = UUID.randomUUID();
        BigDecimal total = r.getItems().stream().filter(i -> i.getRole() == RecommendationRole.PRIMARY)
                .map(RecommendationItem::getTotalAmount).findFirst().orElse(null);
        var alternatives = r.getItems().stream().filter(i -> i.getRole() == RecommendationRole.ALTERNATIVE)
                .map(RecommendationItem::getQuotationId).toList();
        enqueue(eventId, r, RecommendationConstants.EVENT_SUBMITTED_FOR_APPROVAL,
                new RecommendationSubmittedForApprovalEvent(eventId, RecommendationConstants.EVENT_SUBMITTED_FOR_APPROVAL,
                        Instant.now(), CorrelationIdFilter.currentOrNew(), r.getId(), r.getRecommendationNumber(),
                        r.getComparisonId(), r.getProcurementRequestId(), r.getRecommendedQuotationId(),
                        r.getRecommendedVendorId(), total, r.getCurrencyCode(), r.getOverallScore(), risk(r),
                        r.isRequiresReview(), r.getReviewReasons(), alternatives, r.getExplanation(),
                        r.getSubmittedBy(), r.getSubmissionComment()));
    }

    private void enqueue(UUID eventId, Recommendation r, String type, Object event) {
        outboxService.enqueue(eventId, RecommendationConstants.AGGREGATE_TYPE, r.getId(), type,
                properties.recommendationEventsTopic(), event);
    }

    private static String risk(Recommendation r) {
        return r.getRiskLevel() == null ? null : r.getRiskLevel().name();
    }
}
