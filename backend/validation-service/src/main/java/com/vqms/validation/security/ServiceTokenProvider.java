package com.vqms.validation.security;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.vqms.validation.config.JwtProperties;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;

/**
 * Mints short-lived INTERNAL_SERVICE tokens for calls made without a user request
 * (message consumers, scheduled jobs). Signed with the shared Identity secret - the current
 * VQMS contract. Replace with OAuth2 client-credentials when the Identity Service supports it.
 */
@Component
public class ServiceTokenProvider {

    private final JwtProperties properties;
    private final String serviceName;
    private String token;
    private Instant expiresAt = Instant.EPOCH;

    public ServiceTokenProvider(JwtProperties properties, @Value("${spring.application.name}") String serviceName) {
        this.properties = properties;
        this.serviceName = serviceName;
    }

    public synchronized String getToken() {
        Instant now = Instant.now();
        if (token == null || now.isAfter(expiresAt.minusSeconds(30))) {
            Instant expiry = now.plus(properties.serviceTokenTtl());
            JWTClaimsSet claims = new JWTClaimsSet.Builder()
                    .subject(serviceName)
                    .claim(properties.roleClaim(), Roles.INTERNAL_SERVICE)
                    .claim(properties.userIdClaim(), properties.serviceUserId().toString())
                    .issueTime(Date.from(now))
                    .expirationTime(Date.from(expiry))
                    .build();
            SignedJWT jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.parse(properties.algorithm())), claims);
            try {
                jwt.sign(new MACSigner(properties.secret().getBytes(StandardCharsets.UTF_8)));
            } catch (JOSEException ex) {
                throw new IllegalStateException("Unable to sign service token", ex);
            }
            token = jwt.serialize();
            expiresAt = expiry;
        }
        return token;
    }
}
