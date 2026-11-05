package com.vqms.validation.client;

import com.vqms.validation.client.dto.VendorData;
import com.vqms.validation.exception.ExternalServiceUnavailableException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.Optional;
import java.util.UUID;

/** Reads vendor master data. Empty result = vendor does not exist (reported as an ERROR issue). */
@Component
public class VendorServiceClient {

    private static final String SERVICE = "Vendor Service";

    private final RestClient restClient;

    public VendorServiceClient(RestClientFactory factory, @Value("${services.vendor.base-url}") String baseUrl) {
        this.restClient = factory.create(baseUrl);
    }

    public Optional<VendorData> findVendor(UUID vendorId) {
        try {
            return Optional.ofNullable(restClient.get().uri("/api/v1/vendors/{id}", vendorId)
                    .retrieve().body(VendorData.class));
        } catch (HttpClientErrorException.NotFound ex) {
            return Optional.empty();
        } catch (RestClientException ex) {
            throw new ExternalServiceUnavailableException(SERVICE, ex);
        }
    }
}
