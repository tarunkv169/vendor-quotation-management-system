package com.vqms.notification.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.vqms.notification.exception.ExternalServiceUnavailableException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.Optional;
import java.util.UUID;

/** Resolves a user's e-mail address from the Identity Service (GET /api/v1/auth/users/{id}). */
@Component
public class IdentityServiceClient {

    private static final String SERVICE = "Identity Service";

    private final RestClient restClient;

    public IdentityServiceClient(RestClientFactory factory, @Value("${services.identity.base-url}") String baseUrl) {
        this.restClient = factory.create(baseUrl);
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record UserContact(UUID id, String email, String fullName, String status) {
    }

    public Optional<UserContact> findUser(UUID userId) {
        try {
            return Optional.ofNullable(restClient.get().uri("/api/v1/auth/users/{id}", userId)
                    .retrieve().body(UserContact.class));
        } catch (HttpClientErrorException.NotFound ex) {
            return Optional.empty();
        } catch (RestClientException ex) {
            throw new ExternalServiceUnavailableException(SERVICE, ex);
        }
    }
}
