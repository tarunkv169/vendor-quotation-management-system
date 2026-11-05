package com.vqms.gateway.config;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.util.List;

/**
 * Edge security settings ({@code vqms.gateway.*}).
 *
 * @param publicPaths paths reachable without a token (login, registration, health)
 */
@Validated
@ConfigurationProperties(prefix = "vqms.gateway")
public record GatewayJwtProperties(
        @NotBlank @Size(min = 32) String jwtSecret,
        @NotBlank String jwtAlgorithm,
        @NotBlank String roleClaim,
        @NotBlank String userIdClaim,
        @NotEmpty List<String> publicPaths,
        @NotEmpty List<String> allowedOrigins
) {
}
