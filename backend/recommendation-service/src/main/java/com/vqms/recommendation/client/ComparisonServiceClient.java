package com.vqms.recommendation.client;

import com.vqms.recommendation.client.dto.ComparisonResults;
import com.vqms.recommendation.exception.ExternalServiceUnavailableException;
import com.vqms.recommendation.exception.InvalidRecommendationException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.UUID;

/** Reads completed comparison results; prices and criterion scores are never recalculated here. */
@Component
public class ComparisonServiceClient {

    private static final String SERVICE = "Comparison Service";

    private final RestClient restClient;

    public ComparisonServiceClient(RestClientFactory factory, @Value("${services.comparison.base-url}") String baseUrl) {
        this.restClient = factory.create(baseUrl);
    }

    public ComparisonResults getResults(UUID comparisonId) {
        try {
            ComparisonResults results = restClient.get().uri("/api/v1/comparisons/{id}/results", comparisonId)
                    .retrieve().body(ComparisonResults.class);
            if (results == null || results.comparison() == null) {
                throw new ExternalServiceUnavailableException(SERVICE, new IllegalStateException("Empty response"));
            }
            return results;
        } catch (HttpClientErrorException.NotFound ex) {
            throw new InvalidRecommendationException("Comparison not found: " + comparisonId);
        } catch (RestClientException ex) {
            throw new ExternalServiceUnavailableException(SERVICE, ex);
        }
    }
}
