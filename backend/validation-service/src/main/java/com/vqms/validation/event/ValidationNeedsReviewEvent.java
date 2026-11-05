package com.vqms.validation.event;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Published when a human must review warnings before the quotation can be compared. */
public record ValidationNeedsReviewEvent(
        UUID eventId,
        String eventType,
        Instant occurredAt,
        String correlationId,
        UUID validationId,
        UUID quotationId,
        UUID vendorId,
        UUID procurementRequestId,
        int warningCount,
        List<String> warningCodes
) {
}
