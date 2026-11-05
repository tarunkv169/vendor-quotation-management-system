package com.vqms.document.exception;

/**
 * Thrown when a downstream microservice (Quotation, Vendor) cannot be reached,
 * times out or returns a server error. Mapped to HTTP 503.
 */
public class ExternalServiceUnavailableException extends RuntimeException {

    private final String serviceName;

    public ExternalServiceUnavailableException(String serviceName, Throwable cause) {
        super(serviceName + " is currently unavailable", cause);
        this.serviceName = serviceName;
    }

    public String getServiceName() {
        return serviceName;
    }
}
