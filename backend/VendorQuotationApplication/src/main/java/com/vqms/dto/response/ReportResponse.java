package com.vqms.dto.response;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
public class ReportResponse {

    private UUID id;
    private String reportType;
    private String reportName;
    private String description;
    private String format;
    private String status;
    private Long totalRecords;
    private String filePath;
    private UUID generatedBy;
    private LocalDateTime generatedAt;
    private String filterParams;
}
