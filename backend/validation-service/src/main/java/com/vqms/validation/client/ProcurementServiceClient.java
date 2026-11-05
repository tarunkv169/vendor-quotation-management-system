package com.vqms.validation.client;

import com.vqms.validation.client.dto.ProcurementRequestData;
import com.vqms.validation.exception.ExternalServiceUnavailableException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.Optional;
import java.util.UUID;

/** Reads procurement requests (status, required date and requested items). */
@Component
public class ProcurementServiceClient {

    private static final String SERVICE = "Procurement Service";

    private final RestClient restClient;

    public ProcurementServiceClient(RestClientFactory factory,
                                    @Value("${services.procurement.base-url}") String baseUrl) {
        this.restClient = factory.create(baseUrl);
    }

    public Optional<ProcurementRequestData> findProcurementRequest(UUID procurementRequestId) {
        try {
            return Optional.ofNullable(restClient.get()
                    .uri("/api/v1/procurement-requests/{id}", procurementRequestId)
                    .retrieve().body(ProcurementRequestData.class));
        } catch (HttpClientErrorException.NotFound ex) {
            return Optional.empty();
        } catch (RestClientException ex) {
            throw new ExternalServiceUnavailableException(SERVICE, ex);
        }
    }
}
