package com.vqms.dto.response;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
public class ProcurementItemResponse {

    private UUID id;

    private String description;

    private Integer quantity;

    private String unit;

    private BigDecimal expectedUnitPrice;

    private String category;

    private String specification;

    private String priority;

    private UUID procurementRequestId;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
