package com.vqms.validation.dto.response;

import java.time.Instant;
import java.util.Map;

/** Error body shared by all VQMS services. */
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
