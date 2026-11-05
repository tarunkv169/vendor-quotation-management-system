package com.vqms.validation.event;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Published when a quotation FAILED validation (at least one ERROR). */
public record ValidationFailedEvent(
        UUID eventId,
        String eventType,
        Instant occurredAt,
        String correlationId,
        UUID validationId,
        UUID quotationId,
        UUID vendorId,
        UUID procurementRequestId,
        int errorCount,
        int warningCount,
        List<String> errorCodes
) {
}
