package com.vqms.comparison.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.vqms.comparison.client.dto.PlatformQuotation;
import com.vqms.comparison.client.dto.QuotationDetails;
import com.vqms.comparison.exception.ExternalServiceUnavailableException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Reads authoritative quotations; financial values always come from here, never from AI extraction.
 * Quotations are read from the platform application (VendorQuotationApplication), which stores the quotations
 * entered in the UI; see {@link PlatformQuotation} for the mapping.
 */
@Component
public class QuotationServiceClient {

    private static final String SERVICE = "Quotation Service";
    private static final int PAGE_SIZE = 100;

    private final RestClient restClient;

    public QuotationServiceClient(RestClientFactory factory, @Value("${services.quotation.base-url}") String baseUrl) {
        this.restClient = factory.create(baseUrl);
    }

    public Optional<QuotationDetails> findQuotation(UUID quotationId) {
        try {
            PlatformQuotation quotation = restClient.get().uri("/api/v1/quotations/{id}", quotationId)
                    .retrieve().body(PlatformQuotation.class);
            return Optional.ofNullable(quotation).map(PlatformQuotation::toDetails);
        } catch (HttpClientErrorException.NotFound ex) {
            return Optional.empty();
        } catch (RestClientException ex) {
            throw new ExternalServiceUnavailableException(SERVICE, ex);
        }
    }

    /** Ids of all quotations submitted for a procurement request. */
    public List<UUID> listQuotationIds(UUID procurementRequestId) {
        List<UUID> ids = new ArrayList<>();
        try {
            for (int page = 0; page < 20; page++) {
                final int current = page;
                JsonNode body = restClient.get()
                        .uri(uri -> uri.path("/api/v1/quotations/request/{id}")
                                .queryParam("page", current).queryParam("size", PAGE_SIZE).build(procurementRequestId))
                        .retrieve().body(JsonNode.class);
                if (body == null || !body.has("content")) {
                    break;
                }
                body.get("content").forEach(row -> ids.add(UUID.fromString(row.get("id").asText())));
                if (body.get("content").size() < PAGE_SIZE) {
                    break;
                }
            }
            return ids;
        } catch (HttpClientErrorException.NotFound ex) {
            return ids;
        } catch (RestClientException ex) {
            throw new ExternalServiceUnavailableException(SERVICE, ex);
        }
    }
}
