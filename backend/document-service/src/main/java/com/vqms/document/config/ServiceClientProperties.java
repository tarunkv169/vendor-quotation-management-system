package com.vqms.document.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;

/**
 * Downstream service locations and HTTP timeouts, bound from {@code services.*}.
 */
@Validated
@ConfigurationProperties(prefix = "services")
public record ServiceClientProperties(
        @Valid @NotNull Endpoint quotation,
        @Valid @NotNull Endpoint vendor,
        @Valid @NotNull Http http
) {

    public record Endpoint(@NotBlank String baseUrl) {
    }

    public record Http(@NotNull Duration connectTimeout, @NotNull Duration readTimeout) {
    }
}
