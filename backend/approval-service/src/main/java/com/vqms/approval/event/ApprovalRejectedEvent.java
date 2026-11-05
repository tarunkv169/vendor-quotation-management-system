package com.vqms.approval.event;

import java.time.Instant;
import java.util.UUID;

/** Approval rejected (or cancelled, see {@code cancelled}) with the mandatory comment. */
public record ApprovalRejectedEvent(UUID eventId, String eventType, Instant occurredAt, String correlationId,
                                    UUID approvalId, String approvalNumber, UUID recommendationId,
                                    UUID procurementRequestId, UUID quotationId, Integer levelNumber,
                                    UUID decidedBy, String comment, boolean cancelled) {
}
