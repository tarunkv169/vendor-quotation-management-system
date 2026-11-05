package com.vqms.reporting.exception;

/** A downstream service is unreachable, timed out or returned a server error. Mapped to HTTP 503. */
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
