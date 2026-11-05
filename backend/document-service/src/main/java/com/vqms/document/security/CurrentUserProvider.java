package com.vqms.document.security;

import com.vqms.document.config.JwtProperties;
import com.vqms.document.exception.DocumentAccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.Locale;
import java.util.UUID;

/**
 * Reads the current caller from Spring Security's context.
 * This is the only place where identity is derived - services never accept user or vendor ids
 * from request bodies as proof of identity.
 */
@Component
public class CurrentUserProvider {

    private final JwtProperties jwtProperties;

    public CurrentUserProvider(JwtProperties jwtProperties) {
        this.jwtProperties = jwtProperties;
    }

    public AuthenticatedUser getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (!(authentication instanceof JwtAuthenticationToken jwtAuthentication)) {
            throw new AuthenticationCredentialsNotFoundException("No authenticated JWT principal");
        }
        Jwt jwt = jwtAuthentication.getToken();

        UUID userId = parseUuid(jwt.getClaimAsString(jwtProperties.userIdClaim()), "userId");
        String role = normalizeRole(jwt.getClaimAsString(jwtProperties.roleClaim()));
        UUID vendorId = parseUuid(jwt.getClaimAsString(jwtProperties.vendorIdClaim()), "vendorId");

        AuthenticatedUser user = new AuthenticatedUser(userId, jwt.getSubject(), role, vendorId);
        if (user.userId() == null) {
            throw new DocumentAccessDeniedException("Token does not contain a user id");
        }
        if (user.isVendor() && user.vendorId() == null) {
            throw new DocumentAccessDeniedException("Vendor account is not linked to a vendor profile");
        }
        return user;
    }

    /** Accepts "VENDOR", "vendor" or "ROLE_VENDOR" and returns "VENDOR". */
    public static String normalizeRole(String rawRole) {
        if (!StringUtils.hasText(rawRole)) {
            return null;
        }
        String upper = rawRole.trim().toUpperCase(Locale.ROOT);
        return upper.startsWith("ROLE_") ? upper.substring("ROLE_".length()) : upper;
    }

    private static UUID parseUuid(String value, String claimName) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException ex) {
            throw new DocumentAccessDeniedException("Token claim '" + claimName + "' is not a valid UUID");
        }
    }
}
