package com.vqms.document.client;

import com.vqms.document.client.dto.VendorSummary;
import com.vqms.document.exception.DocumentAccessDeniedException;
import com.vqms.document.exception.ExternalServiceUnavailableException;
import com.vqms.document.exception.InvalidDocumentException;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.UUID;

/** Verifies vendor references against the Vendor Service. */
@Component
public class VendorServiceClient {

    private static final String SERVICE_NAME = "Vendor Service";

    private final RestClient restClient;

    public VendorServiceClient(@Qualifier("vendorRestClient") RestClient restClient) {
        this.restClient = restClient;
    }

    public VendorSummary getVendor(UUID vendorId) {
        try {
            VendorSummary vendor = restClient.get()
                    .uri("/api/v1/vendors/{id}", vendorId)
                    .retrieve()
                    .body(VendorSummary.class);
            if (vendor == null) {
                throw new ExternalServiceUnavailableException(SERVICE_NAME,
                        new IllegalStateException("Empty vendor response"));
            }
            return vendor;
        } catch (HttpClientErrorException.NotFound ex) {
            throw new InvalidDocumentException("Vendor not found: " + vendorId);
        } catch (HttpClientErrorException.Forbidden | HttpClientErrorException.Unauthorized ex) {
            throw new DocumentAccessDeniedException("You are not allowed to access vendor " + vendorId);
        } catch (RestClientException ex) {
            throw new ExternalServiceUnavailableException(SERVICE_NAME, ex);
        }
    }

    /** Throws when the vendor does not exist or is not ACTIVE. */
    public void assertVendorActive(UUID vendorId) {
        if (!getVendor(vendorId).isActive()) {
            throw new InvalidDocumentException("Vendor " + vendorId + " is not active");
        }
    }
}
