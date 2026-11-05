package com.vqms.notification.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;

/** Notification settings ({@code vqms.notification.*}). */
@Validated
@ConfigurationProperties(prefix = "vqms.notification")
public record NotificationProperties(@Valid @NotNull Email email) {

    /** @param enabled email delivery switch (in-app notifications are always created) */
    public record Email(boolean enabled, @NotBlank String from, @Min(1) @Max(10) int maxAttempts,
                        @NotNull Duration retryInterval) {
    }
}
