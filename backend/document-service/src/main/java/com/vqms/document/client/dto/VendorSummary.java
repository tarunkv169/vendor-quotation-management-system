package com.vqms.document.client.dto;

import java.util.UUID;

/** The subset of Vendor Service's VendorResponse that this service needs. */
public record VendorSummary(UUID id, String name, String status) {

    public boolean isActive() {
        return "ACTIVE".equalsIgnoreCase(status);
    }
}
