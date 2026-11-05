package com.vqms.validation.config;

import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Outbox channel name for validation events ({@code vqms.messaging.*}). */
@Validated
@ConfigurationProperties(prefix = "vqms.messaging")
public record MessagingProperties(
        @NotBlank String validationEventsTopic
) {
}
