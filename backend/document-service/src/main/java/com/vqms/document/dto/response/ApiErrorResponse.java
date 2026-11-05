package com.vqms.document.dto.response;

import java.time.Instant;
import java.util.Map;

/**
 * Error body shared by all VQMS services (same shape as quotation-service),
 * extended with the correlation id so errors can be traced across services.
 */
public record ApiErrorResponse(
        Instant timestamp,
        int status,
        String error,
        String message,
        String path,
        String correlationId,
        Map<String, String> validationErrors
) {
}
