package com.vqms.document.config;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * JWT contract with the Identity Service, bound from {@code vqms.security.jwt.*}.
 *
 * @param secret        shared HMAC secret (min 32 chars); always supplied via env var JWT_SECRET
 * @param algorithm     HS256, HS384 or HS512 - must match what Identity Service signs with
 * @param roleClaim     claim that holds the single role string, e.g. "VENDOR"
 * @param userIdClaim   claim that holds the user UUID
 * @param vendorIdClaim claim that holds the vendor UUID for vendor users
 */
@Validated
@ConfigurationProperties(prefix = "vqms.security.jwt")
public record JwtProperties(
        @NotBlank @Size(min = 32, message = "JWT secret must be at least 32 characters") String secret,
        @NotBlank String algorithm,
        @NotBlank String roleClaim,
        @NotBlank String userIdClaim,
        @NotBlank String vendorIdClaim
) {
}
