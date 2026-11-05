package com.vqms.approval.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.vqms.approval.exception.ExternalServiceUnavailableException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.Optional;
import java.util.UUID;

/** Verifies users (e.g. delegates) against the Identity Service: GET /api/v1/auth/users/{id}. */
@Component
public class IdentityServiceClient {

    private static final String SERVICE = "Identity Service";

    private final RestClient restClient;

    public IdentityServiceClient(RestClientFactory factory, @Value("${services.identity.base-url}") String baseUrl) {
        this.restClient = factory.create(baseUrl);
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record UserInfo(UUID id, String username, String role, String status) {

        public boolean isActive() {
            return status == null || "ACTIVE".equalsIgnoreCase(status);
        }
    }

    public Optional<UserInfo> findUser(UUID userId) {
        try {
            return Optional.ofNullable(restClient.get().uri("/api/v1/auth/users/{id}", userId)
                    .retrieve().body(UserInfo.class));
        } catch (HttpClientErrorException.NotFound ex) {
            return Optional.empty();
        } catch (RestClientException ex) {
            throw new ExternalServiceUnavailableException(SERVICE, ex);
        }
    }
}
