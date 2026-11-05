package com.vqms.comparison.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vqms.comparison.client.dto.ValidationSummary;
import com.vqms.comparison.exception.ExternalServiceUnavailableException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.Optional;
import java.util.UUID;

/** Reads the latest validation result of a quotation (eligibility gate). */
@Component
public class ValidationServiceClient {

    private static final String SERVICE = "Validation Service";

    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    public ValidationServiceClient(RestClientFactory factory, ObjectMapper objectMapper,
                                   @Value("${services.validation.base-url}") String baseUrl) {
        this.restClient = factory.create(baseUrl);
        this.objectMapper = objectMapper;
    }

    public Optional<ValidationSummary> findLatest(UUID quotationId) {
        try {
            JsonNode body = restClient.get()
                    .uri(uri -> uri.path("/api/v1/validations/quotation/{id}")
                            .queryParam("page", 0).queryParam("size", 1).queryParam("sort", "createdAt,desc")
                            .build(quotationId))
                    .retrieve().body(JsonNode.class);
            if (body == null || !body.has("content") || body.get("content").isEmpty()) {
                return Optional.empty();
            }
            return Optional.of(objectMapper.treeToValue(body.get("content").get(0), ValidationSummary.class));
        } catch (HttpClientErrorException.NotFound ex) {
            return Optional.empty();
        } catch (RestClientException | com.fasterxml.jackson.core.JsonProcessingException ex) {
            throw new ExternalServiceUnavailableException(SERVICE, ex);
        }
    }
}
