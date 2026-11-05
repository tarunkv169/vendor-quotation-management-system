package com.vqms.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "reports", indexes = {
        @Index(name = "idx_report_type", columnList = "report_type"),
        @Index(name = "idx_report_created", columnList = "generated_at")
})
@Getter
@Setter
@NoArgsConstructor
public class Report {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "report_type", nullable = false, length = 50)
    private String reportType;

    @Column(name = "report_name", nullable = false, length = 200)
    private String reportName;

    @Column(name = "description", length = 500)
    private String description;

    @Column(name = "format", nullable = false, length = 20)
    private String format = "JSON";

    @Column(name = "status", nullable = false, length = 20)
    private String status = "COMPLETED";

    @Column(name = "total_records")
    private Long totalRecords;

    @Column(name = "file_path", length = 500)
    private String filePath;

    @Column(name = "generated_by", nullable = false)
    private UUID generatedBy;

    @Column(name = "generated_at", nullable = false, updatable = false)
    private LocalDateTime generatedAt;

    @Column(name = "filter_params", columnDefinition = "TEXT")
    private String filterParams;

    @PrePersist
    protected void onCreate() {
        generatedAt = LocalDateTime.now();
    }
}
