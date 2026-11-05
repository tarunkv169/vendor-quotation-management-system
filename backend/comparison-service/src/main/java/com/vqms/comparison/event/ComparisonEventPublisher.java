package com.vqms.comparison.event;

import com.vqms.comparison.config.CorrelationIdFilter;
import com.vqms.comparison.config.MessagingProperties;
import com.vqms.comparison.constants.ComparisonConstants;
import com.vqms.comparison.entity.Comparison;
import com.vqms.comparison.entity.ComparisonItem;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Comparator;
import java.util.UUID;

/** Writes comparison events to the transactional outbox (call inside the business transaction). */
@Component
public class ComparisonEventPublisher {

    private final OutboxService outboxService;
    private final MessagingProperties properties;

    public ComparisonEventPublisher(OutboxService outboxService, MessagingProperties properties) {
        this.outboxService = outboxService;
        this.properties = properties;
    }

    public void publishCompleted(Comparison c) {
        UUID eventId = UUID.randomUUID();
        var rankings = c.getItems().stream()
                .sorted(Comparator.comparing(ComparisonItem::getRankPosition,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .map(i -> new ComparisonCompletedEvent.Ranking(i.getRankPosition(), i.getQuotationId(),
                        i.getVendorId(), i.getResultType(), i.getEligibilityReasons(), i.getTotalAmount(),
                        i.getOverallScore(), i.getCriterionScores(), i.getMissingCriteria(), i.getMaxDeliveryDays(),
                        i.getMinWarrantyMonths(), i.getItemCoveragePercent(), i.isLowestPrice()))
                .toList();
        ComparisonCompletedEvent event = new ComparisonCompletedEvent(eventId,
                ComparisonConstants.EVENT_COMPARISON_COMPLETED, Instant.now(), CorrelationIdFilter.currentOrNew(),
                c.getId(), c.getComparisonNumber(), c.getProcurementRequestId(), c.getCurrencyCode(),
                c.getCriteriaWeights(), c.getExcludedCriteria(), c.isRequiresReview(), c.getLowestQuotationId(),
                rankings);
        outboxService.enqueue(eventId, ComparisonConstants.AGGREGATE_TYPE, c.getId(),
                ComparisonConstants.EVENT_COMPARISON_COMPLETED, properties.comparisonEventsTopic(), event);
    }

    public void publishFailed(Comparison c, String reason) {
        UUID eventId = UUID.randomUUID();
        ComparisonFailedEvent event = new ComparisonFailedEvent(eventId, ComparisonConstants.EVENT_COMPARISON_FAILED,
                Instant.now(), CorrelationIdFilter.currentOrNew(), c.getId(), c.getComparisonNumber(),
                c.getProcurementRequestId(), reason);
        outboxService.enqueue(eventId, ComparisonConstants.AGGREGATE_TYPE, c.getId(),
                ComparisonConstants.EVENT_COMPARISON_FAILED, properties.comparisonEventsTopic(), event);
    }
}
