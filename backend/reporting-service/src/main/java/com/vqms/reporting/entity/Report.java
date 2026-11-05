package com.vqms.reporting.entity;

import com.fasterxml.jackson.databind.JsonNode;
import com.vqms.reporting.entity.base.BaseEntity;
import com.vqms.reporting.enums.ReportStatus;
import com.vqms.reporting.enums.ReportType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Immutable snapshot of a generated report (data as it was at generation time). */
@Entity
@Table(name = "reports")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Report extends BaseEntity {

    @Column(name = "report_number", nullable = false, length = 40, unique = true)
    private String reportNumber;

    @Enumerated(EnumType.STRING)
    @Column(name = "report_type", nullable = false, length = 40)
    private ReportType reportType;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private ReportStatus status;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "parameters", nullable = false, columnDefinition = "jsonb")
    private Map<String, String> parameters;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "data", columnDefinition = "jsonb")
    private JsonNode data;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "warnings", columnDefinition = "jsonb")
    private List<String> warnings;

    @Column(name = "row_count", nullable = false)
    private int rowCount;

    @Column(name = "failure_reason", length = 1000)
    private String failureReason;

    @Column(name = "generated_by", nullable = false)
    private UUID generatedBy;

    @Column(name = "generated_at", nullable = false)
    private Instant generatedAt;

    @Column(name = "duration_ms", nullable = false)
    private long durationMs;

    @Builder
    private Report(String reportNumber, ReportType reportType, ReportStatus status, Map<String, String> parameters,
                   JsonNode data, List<String> warnings, int rowCount, String failureReason, UUID generatedBy,
                   long durationMs) {
        this.reportNumber = reportNumber;
        this.reportType = reportType;
        this.status = status;
        this.parameters = parameters;
        this.data = data;
        this.warnings = warnings == null ? List.of() : List.copyOf(warnings);
        this.rowCount = rowCount;
        this.failureReason = failureReason;
        this.generatedBy = generatedBy;
        this.generatedAt = Instant.now();
        this.durationMs = durationMs;
    }
}
