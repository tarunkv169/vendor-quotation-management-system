package com.vqms.recommendation.client;

import com.vqms.recommendation.client.dto.ProcurementRequestInfo;
import com.vqms.recommendation.exception.ExternalServiceUnavailableException;
import com.vqms.recommendation.exception.InvalidRecommendationException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.UUID;

@Component
public class ProcurementServiceClient {

    private static final String SERVICE = "Procurement Service";

    private final RestClient restClient;

    public ProcurementServiceClient(RestClientFactory factory,
                                    @Value("${services.procurement.base-url}") String baseUrl) {
        this.restClient = factory.create(baseUrl);
    }

    public ProcurementRequestInfo getProcurementRequest(UUID id) {
        try {
            ProcurementRequestInfo info = restClient.get().uri("/api/v1/procurement-requests/{id}", id)
                    .retrieve().body(ProcurementRequestInfo.class);
            if (info == null) {
                throw new ExternalServiceUnavailableException(SERVICE, new IllegalStateException("Empty response"));
            }
            return info;
        } catch (HttpClientErrorException.NotFound ex) {
            throw new InvalidRecommendationException("Procurement request not found: " + id);
        } catch (RestClientException ex) {
            throw new ExternalServiceUnavailableException(SERVICE, ex);
        }
    }
}
