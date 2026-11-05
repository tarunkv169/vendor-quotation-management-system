package com.vqms.approval.event;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * All levels approved. The Quotation and Procurement services can now award the quotation;
 * the Notification Service informs the participants.
 */
public record ApprovalCompletedEvent(UUID eventId, String eventType, Instant occurredAt, String correlationId,
                                     UUID approvalId, String approvalNumber, UUID recommendationId,
                                     UUID procurementRequestId, UUID quotationId, UUID vendorId, BigDecimal amount,
                                     String currencyCode, Instant decidedAt, List<UUID> approvers) {
}
