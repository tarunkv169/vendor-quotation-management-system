package com.vqms.validation.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vqms.validation.client.dto.PlatformQuotation;
import com.vqms.validation.client.dto.QuotationData;
import com.vqms.validation.client.dto.QuotationSummaryData;
import com.vqms.validation.exception.ExternalServiceUnavailableException;
import com.vqms.validation.exception.InvalidValidationRequestException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Reads authoritative quotations. They are read from the platform application (VendorQuotationApplication),
 * which stores the quotations entered in the UI; see {@link PlatformQuotation} for the mapping.
 */
@Component
public class QuotationServiceClient {

    private static final String SERVICE = "Quotation Service";
    private static final int PAGE_SIZE = 100;

    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    public QuotationServiceClient(RestClientFactory factory, ObjectMapper objectMapper,
                                  @Value("${services.quotation.base-url}") String baseUrl) {
        this.restClient = factory.create(baseUrl);
        this.objectMapper = objectMapper;
    }

    /** @throws InvalidValidationRequestException when the quotation does not exist */
    public QuotationData getQuotation(UUID quotationId) {
        try {
            PlatformQuotation quotation = restClient.get().uri("/api/v1/quotations/{id}", quotationId)
                    .retrieve().body(PlatformQuotation.class);
            if (quotation == null) {
                throw new ExternalServiceUnavailableException(SERVICE, new IllegalStateException("Empty response"));
            }
            return quotation.toData();
        } catch (HttpClientErrorException.NotFound ex) {
            throw new InvalidValidationRequestException("Quotation not found: " + quotationId);
        } catch (HttpClientErrorException.Forbidden | HttpClientErrorException.Unauthorized ex) {
            throw new InvalidValidationRequestException("Access to quotation " + quotationId + " was denied");
        } catch (RestClientException ex) {
            throw new ExternalServiceUnavailableException(SERVICE, ex);
        }
    }

    /** All quotations of a procurement request (paged Spring Data response). */
    public List<QuotationSummaryData> listByProcurementRequest(UUID procurementRequestId) {
        List<QuotationSummaryData> result = new ArrayList<>();
        try {
            for (int page = 0; page < 20; page++) {
                final int currentPage = page;
                JsonNode body = restClient.get()
                        .uri(uri -> uri.path("/api/v1/quotations/request/{id}")
                                .queryParam("page", currentPage).queryParam("size", PAGE_SIZE)
                                .build(procurementRequestId))
                        .retrieve().body(JsonNode.class);
                if (body == null || !body.has("content")) {
                    break;
                }
                for (JsonNode row : body.get("content")) {
                    result.add(objectMapper.treeToValue(row, PlatformQuotation.class).toSummary());
                }
                if (body.path("content").size() < PAGE_SIZE) {
                    break;
                }
            }
            return result;
        } catch (HttpClientErrorException.NotFound ex) {
            return result;
        } catch (RestClientException | com.fasterxml.jackson.core.JsonProcessingException ex) {
            throw new ExternalServiceUnavailableException(SERVICE, ex);
        }
    }
}
