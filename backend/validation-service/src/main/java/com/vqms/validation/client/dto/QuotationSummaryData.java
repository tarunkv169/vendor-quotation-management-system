package com.vqms.validation.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.UUID;

/** Row of the Quotation Service list endpoint, used for duplicate-submission detection. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record QuotationSummaryData(UUID id, String quotationNumber, UUID vendorId, String status) {
}
