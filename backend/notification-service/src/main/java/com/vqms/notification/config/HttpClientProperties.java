package com.vqms.notification.config;

import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;

/** Timeouts for all outgoing REST calls ({@code services.http.*}). */
@Validated
@ConfigurationProperties(prefix = "services.http")
public record HttpClientProperties(@NotNull Duration connectTimeout, @NotNull Duration readTimeout) {
}
