package com.vqms.approval.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.vqms.approval.exception.ExternalServiceUnavailableException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.Optional;
import java.util.UUID;

/** Reads the requester of a procurement request (who may therefore not approve it). */
@Component
public class ProcurementServiceClient {

    private static final String SERVICE = "Procurement Service";

    private final RestClient restClient;

    public ProcurementServiceClient(RestClientFactory factory,
                                    @Value("${services.procurement.base-url}") String baseUrl) {
        this.restClient = factory.create(baseUrl);
    }

    public Optional<UUID> findRequesterId(UUID procurementRequestId) {
        try {
            JsonNode body = restClient.get().uri("/api/v1/procurement-requests/{id}", procurementRequestId)
                    .retrieve().body(JsonNode.class);
            String requester = body == null ? null : body.path("requesterId").asText(null);
            return requester == null || requester.isBlank() ? Optional.empty() : Optional.of(UUID.fromString(requester));
        } catch (HttpClientErrorException.NotFound ex) {
            return Optional.empty();
        } catch (RestClientException ex) {
            throw new ExternalServiceUnavailableException(SERVICE, ex);
        }
    }
}
