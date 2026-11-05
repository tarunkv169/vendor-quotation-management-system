package com.vqms.approval.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;

/** Workflow settings ({@code vqms.approval.*}). */
@Validated
@ConfigurationProperties(prefix = "vqms.approval")
public record ApprovalProperties(@NotNull Duration escalationCheckInterval,
                                 @Min(1) @Max(365) int maxDelegationDays) {
}
