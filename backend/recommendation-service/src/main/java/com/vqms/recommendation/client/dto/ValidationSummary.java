package com.vqms.recommendation.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public record ValidationSummary(UUID id, UUID quotationId, String status) {

    public boolean passed() {
        return "PASSED".equals(status);
    }
}
