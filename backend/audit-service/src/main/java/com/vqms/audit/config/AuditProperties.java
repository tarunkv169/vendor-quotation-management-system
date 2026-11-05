package com.vqms.audit.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * @param maxPayloadBytes upper bound for the stored JSON payload of one audit event
 */
@Validated
@ConfigurationProperties(prefix = "vqms.audit")
public record AuditProperties(@Min(1024) @Max(1048576) int maxPayloadBytes) {
}
