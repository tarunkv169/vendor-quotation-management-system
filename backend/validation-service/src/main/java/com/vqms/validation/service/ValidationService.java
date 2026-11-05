package com.vqms.validation.service;

import com.vqms.validation.dto.request.ValidationRequest;
import com.vqms.validation.dto.response.PageResponse;
import com.vqms.validation.dto.response.ValidationResponse;
import com.vqms.validation.enums.ValidationStatus;
import org.springframework.data.domain.Pageable;

import java.util.UUID;

/** Validation use cases. */
public interface ValidationService {

    ValidationResponse validate(ValidationRequest request);

    ValidationResponse revalidate(UUID validationId);

    ValidationResponse getById(UUID validationId);

    PageResponse<ValidationResponse> getByQuotation(UUID quotationId, Pageable pageable);

    PageResponse<ValidationResponse> search(ValidationStatus status, UUID vendorId, UUID procurementRequestId,
                                            Pageable pageable);

}
