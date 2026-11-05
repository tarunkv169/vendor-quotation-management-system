package com.vqms.validation.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public record ProcurementRequestData(
        UUID id,
        String title,
        String status,
        LocalDateTime requiredBy,
        BigDecimal budget,
        List<Item> items
) {

    public List<Item> safeItems() {
        return items == null ? List.of() : items;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Item(UUID id, String description, BigDecimal quantity, String unit,
                       BigDecimal expectedUnitPrice, String category, String specification) {
    }
}
