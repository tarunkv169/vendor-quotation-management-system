package com.vqms.approval.config;

import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Business-event channel name stored with outbox events ({@code vqms.messaging.*}). */
@Validated
@ConfigurationProperties(prefix = "vqms.messaging")
public record MessagingProperties(@NotBlank String approvalEventsTopic) {
}
