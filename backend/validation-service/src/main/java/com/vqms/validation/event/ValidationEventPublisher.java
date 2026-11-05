package com.vqms.validation.event;

import com.vqms.validation.config.CorrelationIdFilter;
import com.vqms.validation.config.MessagingProperties;
import com.vqms.validation.constants.ValidationConstants;
import com.vqms.validation.entity.ValidationIssue;
import com.vqms.validation.entity.ValidationRecord;
import com.vqms.validation.enums.ValidationSeverity;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Builds the event matching the validation outcome and writes it to the transactional outbox
 * (must be called inside the transaction that saves the record).
 */
@Component
public class ValidationEventPublisher {

    private final OutboxService outboxService;
    private final MessagingProperties properties;

    public ValidationEventPublisher(OutboxService outboxService, MessagingProperties properties) {
        this.outboxService = outboxService;
        this.properties = properties;
    }

    public void publish(ValidationRecord record) {
        UUID eventId = UUID.randomUUID();
        Instant now = Instant.now();
        String correlationId = CorrelationIdFilter.currentOrNew();
        Object event;
        String type;
        switch (record.getStatus()) {
            case PASSED -> {
                type = ValidationConstants.EVENT_VALIDATION_COMPLETED;
                event = new ValidationCompletedEvent(eventId, type, now, correlationId, record.getId(),
                        record.getQuotationId(), record.getQuotationVersion(), record.getVendorId(),
                        record.getProcurementRequestId(), record.getStatus().name(), true, record.getCurrencyCode(),
                        record.getExpectedTotal(), record.getQuotedTotal());
            }
            case FAILED -> {
                type = ValidationConstants.EVENT_VALIDATION_FAILED;
                event = new ValidationFailedEvent(eventId, type, now, correlationId, record.getId(),
                        record.getQuotationId(), record.getVendorId(), record.getProcurementRequestId(),
                        record.getErrorCount(), record.getWarningCount(), codes(record, ValidationSeverity.ERROR));
            }
            case NEEDS_REVIEW -> {
                type = ValidationConstants.EVENT_VALIDATION_NEEDS_REVIEW;
                event = new ValidationNeedsReviewEvent(eventId, type, now, correlationId, record.getId(),
                        record.getQuotationId(), record.getVendorId(), record.getProcurementRequestId(),
                        record.getWarningCount(), codes(record, ValidationSeverity.WARNING));
            }
            default -> {
                return; // PENDING / IN_PROGRESS are not published
            }
        }
        outboxService.enqueue(eventId, ValidationConstants.AGGREGATE_TYPE, record.getId(), type,
                properties.validationEventsTopic(), event);
    }

    private static List<String> codes(ValidationRecord record, ValidationSeverity severity) {
        return record.getIssues().stream()
                .filter(issue -> issue.getSeverity() == severity)
                .map(ValidationIssue::getIssueCode)
                .distinct()
                .toList();
    }
}
