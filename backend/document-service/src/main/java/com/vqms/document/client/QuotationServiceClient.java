package com.vqms.document.client;

import com.vqms.document.client.dto.QuotationSummary;
import com.vqms.document.exception.DocumentAccessDeniedException;
import com.vqms.document.exception.ExternalServiceUnavailableException;
import com.vqms.document.exception.InvalidDocumentException;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.UUID;

/**
 * Reads authoritative quotation data (owner vendor, procurement request, status).
 * The caller's JWT is forwarded (see RestClientConfig), so the Quotation Service applies
 * its own authorization as well.
 */
@Component
public class QuotationServiceClient {

    private static final String SERVICE_NAME = "Quotation Service";

    private final RestClient restClient;

    public QuotationServiceClient(@Qualifier("quotationRestClient") RestClient restClient) {
        this.restClient = restClient;
    }

    public QuotationSummary getQuotation(UUID quotationId) {
        try {
            QuotationSummary quotation = restClient.get()
                    .uri("/api/v1/quotations/{id}", quotationId)
                    .retrieve()
                    .body(QuotationSummary.class);
            if (quotation == null || quotation.vendorId() == null) {
                throw new ExternalServiceUnavailableException(SERVICE_NAME,
                        new IllegalStateException("Empty or incomplete quotation response"));
            }
            return quotation;
        } catch (HttpClientErrorException.NotFound ex) {
            throw new InvalidDocumentException("Quotation not found: " + quotationId);
        } catch (HttpClientErrorException.Forbidden | HttpClientErrorException.Unauthorized ex) {
            throw new DocumentAccessDeniedException("You are not allowed to access quotation " + quotationId);
        } catch (RestClientException ex) {
            throw new ExternalServiceUnavailableException(SERVICE_NAME, ex);
        }
    }
}
