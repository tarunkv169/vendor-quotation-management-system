package com.vqms.dto.response;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
public class ComparisonResponse {

    private UUID id;
    private UUID purchaseRequestId;
    private String comparisonName;
    private UUID createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<ComparisonLineResponse> lines;
}
