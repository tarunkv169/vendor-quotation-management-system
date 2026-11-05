package com.vqms.validation.event;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Written to the outbox (channel vqms.validation.events) when a quotation PASSED validation.
 * The Comparison Service treats it as "quotation eligible for comparison".
 * Amounts are the independently recalculated values; Comparison still reads the authoritative
 * quotation from the Quotation Service.
 */
public record ValidationCompletedEvent(
        UUID eventId,
        String eventType,
        Instant occurredAt,
        String correlationId,
        UUID validationId,
        UUID quotationId,
        Long quotationVersion,
        UUID vendorId,
        UUID procurementRequestId,
        String status,
        boolean eligibleForComparison,
        String currencyCode,
        BigDecimal expectedTotal,
        BigDecimal quotedTotal
) {
}
