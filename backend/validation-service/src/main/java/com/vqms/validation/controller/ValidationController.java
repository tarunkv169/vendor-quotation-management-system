package com.vqms.validation.controller;

import com.vqms.validation.constants.ValidationConstants;
import com.vqms.validation.dto.request.ValidationRequest;
import com.vqms.validation.dto.response.PageResponse;
import com.vqms.validation.dto.response.ValidationResponse;
import com.vqms.validation.enums.ValidationStatus;
import com.vqms.validation.service.ValidationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.UUID;

/** Validation endpoints. Coarse role gates here; record-level access in the service. */
@RestController
@RequestMapping(ValidationConstants.API_BASE_PATH)
@Tag(name = "Validations")
public class ValidationController {

    private final ValidationService validationService;

    public ValidationController(ValidationService validationService) {
        this.validationService = validationService;
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','PROCUREMENT_ADMIN','INTERNAL_SERVICE')")
    @Operation(summary = "Validate a quotation (optionally with its AI extraction)")
    public ResponseEntity<ValidationResponse> validate(@Valid @RequestBody ValidationRequest request) {
        ValidationResponse response = validationService.validate(request);
        return ResponseEntity.created(location(response.id())).body(response);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a validation report with all issues")
    public ResponseEntity<ValidationResponse> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(validationService.getById(id));
    }

    @GetMapping("/quotation/{quotationId}")
    @Operation(summary = "Validation history of a quotation (newest first)")
    public ResponseEntity<PageResponse<ValidationResponse>> byQuotation(
            @PathVariable UUID quotationId, @ParameterObject @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(validationService.getByQuotation(quotationId, pageable));
    }

    @GetMapping
    @Operation(summary = "Search validations")
    public ResponseEntity<PageResponse<ValidationResponse>> search(
            @RequestParam(required = false) ValidationStatus status,
            @RequestParam(required = false) UUID vendorId,
            @RequestParam(required = false) UUID procurementRequestId,
            @ParameterObject @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(validationService.search(status, vendorId, procurementRequestId, pageable));
    }

    @GetMapping("/status/{status}")
    @Operation(summary = "Validations by status")
    public ResponseEntity<PageResponse<ValidationResponse>> byStatus(
            @PathVariable ValidationStatus status, @ParameterObject @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(validationService.search(status, null, null, pageable));
    }

    @PostMapping("/{id}/revalidate")
    @PreAuthorize("hasAnyRole('ADMIN','PROCUREMENT_ADMIN')")
    @Operation(summary = "Run validation again (creates a new record linked to the previous one)")
    public ResponseEntity<ValidationResponse> revalidate(@PathVariable UUID id) {
        ValidationResponse response = validationService.revalidate(id);
        return ResponseEntity.created(location(response.id())).body(response);
    }

    private static URI location(UUID id) {
        return ServletUriComponentsBuilder.fromCurrentContextPath()
                .path(ValidationConstants.API_BASE_PATH + "/{id}").buildAndExpand(id).toUri();
    }
}
