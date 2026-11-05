package com.vqms.approval.config;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;
import java.util.UUID;

/**
 * JWT contract with the Identity Service ({@code vqms.security.jwt.*}).
 *
 * @param serviceUserId   identity used in tokens this service mints for event-driven calls
 * @param serviceTokenTtl lifetime of those service tokens
 */
@Validated
@ConfigurationProperties(prefix = "vqms.security.jwt")
public record JwtProperties(
        @NotBlank @Size(min = 32, message = "JWT secret must be at least 32 characters") String secret,
        @NotBlank String algorithm,
        @NotBlank String roleClaim,
        @NotBlank String userIdClaim,
        @NotBlank String vendorIdClaim,
        @NotNull UUID serviceUserId,
        @NotNull Duration serviceTokenTtl
) {
}
