package com.vqms.comparison.event;

import java.time.Instant;
import java.util.UUID;

/** Published when a comparison could not be calculated (e.g. not enough eligible quotations). */
public record ComparisonFailedEvent(
        UUID eventId,
        String eventType,
        Instant occurredAt,
        String correlationId,
        UUID comparisonId,
        String comparisonNumber,
        UUID procurementRequestId,
        String reason
) {
}
