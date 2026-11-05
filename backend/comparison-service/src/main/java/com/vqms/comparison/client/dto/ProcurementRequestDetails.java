package com.vqms.comparison.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** Authoritative procurement request and its requested items. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ProcurementRequestDetails(UUID id, String title, String status, List<Item> items) {

    public List<Item> safeItems() {
        return items == null ? List.of() : items;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Item(UUID id, String description, BigDecimal quantity, String unit) {
    }
}
