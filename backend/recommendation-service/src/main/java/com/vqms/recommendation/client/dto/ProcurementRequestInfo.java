package com.vqms.recommendation.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.math.BigDecimal;
import java.util.UUID;

/** Procurement requirements relevant to the recommendation (status and budget). */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ProcurementRequestInfo(UUID id, String title, String status, BigDecimal budget) {
}
