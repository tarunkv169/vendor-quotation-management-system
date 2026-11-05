package com.vqms.comparison.client;

import com.vqms.comparison.client.dto.ProcurementRequestDetails;
import com.vqms.comparison.exception.ExternalServiceUnavailableException;
import com.vqms.comparison.exception.InvalidComparisonException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.UUID;

/** Reads procurement requirements (requested items) from the Procurement Service. */
@Component
public class ProcurementServiceClient {

    private static final String SERVICE = "Procurement Service";

    private final RestClient restClient;

    public ProcurementServiceClient(RestClientFactory factory,
                                    @Value("${services.procurement.base-url}") String baseUrl) {
        this.restClient = factory.create(baseUrl);
    }

    public ProcurementRequestDetails getProcurementRequest(UUID id) {
        try {
            ProcurementRequestDetails details = restClient.get().uri("/api/v1/procurement-requests/{id}", id)
                    .retrieve().body(ProcurementRequestDetails.class);
            if (details == null) {
                throw new ExternalServiceUnavailableException(SERVICE, new IllegalStateException("Empty response"));
            }
            return details;
        } catch (HttpClientErrorException.NotFound ex) {
            throw new InvalidComparisonException("Procurement request not found: " + id);
        } catch (RestClientException ex) {
            throw new ExternalServiceUnavailableException(SERVICE, ex);
        }
    }
}
