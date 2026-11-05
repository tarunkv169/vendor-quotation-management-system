package com.vqms.reporting.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** @param maxSourceRows safety cap on how many source rows one report may read */
@Validated
@ConfigurationProperties(prefix = "vqms.reporting")
public record ReportingProperties(@Min(100) @Max(100000) int maxSourceRows) {
}
