package com.vqms.comparison.controller;

import com.vqms.comparison.constants.ComparisonConstants;
import com.vqms.comparison.dto.request.ComparisonRequest;
import com.vqms.comparison.dto.response.ComparisonResponse;
import com.vqms.comparison.dto.response.ComparisonResultResponse;
import com.vqms.comparison.dto.response.PageResponse;
import com.vqms.comparison.dto.response.VendorComparisonResponse;
import com.vqms.comparison.enums.ComparisonStatus;
import com.vqms.comparison.service.ComparisonService;
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

import java.util.List;
import java.util.UUID;

/**
 * Comparison endpoints. Vendors have no access: comparisons expose competitors' prices.
 * The class-level {@code @PreAuthorize} applies to all reads; write methods narrow it further.
 */
@RestController
@RequestMapping(ComparisonConstants.API_BASE_PATH)
@PreAuthorize("hasAnyRole('ADMIN','PROCUREMENT_ADMIN','PROCUREMENT_MANAGER','EMPLOYEE','INTERNAL_SERVICE')")
@Tag(name = "Comparisons")
public class ComparisonController {

    private final ComparisonService comparisonService;

    public ComparisonController(ComparisonService comparisonService) {
        this.comparisonService = comparisonService;
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','PROCUREMENT_ADMIN','PROCUREMENT_MANAGER')")
    @Operation(summary = "Create a comparison with procurement-specific criteria weights")
    public ResponseEntity<ComparisonResponse> create(@Valid @RequestBody ComparisonRequest request) {
        ComparisonResponse response = comparisonService.create(request);
        return ResponseEntity.created(ServletUriComponentsBuilder.fromCurrentContextPath()
                .path(ComparisonConstants.API_BASE_PATH + "/{id}").buildAndExpand(response.id()).toUri())
                .body(response);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a comparison")
    public ResponseEntity<ComparisonResponse> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(comparisonService.getById(id));
    }

    @GetMapping
    @Operation(summary = "Search comparisons")
    public ResponseEntity<PageResponse<ComparisonResponse>> search(
            @RequestParam(required = false) ComparisonStatus status,
            @RequestParam(required = false) UUID procurementRequestId,
            @ParameterObject @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(comparisonService.search(status, procurementRequestId, pageable));
    }

    @GetMapping("/procurement-request/{id}")
    @Operation(summary = "Comparisons of a procurement request")
    public ResponseEntity<PageResponse<ComparisonResponse>> byProcurementRequest(
            @PathVariable UUID id, @ParameterObject @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(comparisonService.search(null, id, pageable));
    }

    @PostMapping("/{id}/calculate")
    @PreAuthorize("hasAnyRole('ADMIN','PROCUREMENT_ADMIN','PROCUREMENT_MANAGER')")
    @Operation(summary = "Calculate (or recalculate) scores and ranking")
    public ResponseEntity<ComparisonResultResponse> calculate(@PathVariable UUID id) {
        return ResponseEntity.ok(comparisonService.calculate(id));
    }

    @GetMapping("/{id}/results")
    @Operation(summary = "Detailed comparison report")
    public ResponseEntity<ComparisonResultResponse> results(@PathVariable UUID id) {
        return ResponseEntity.ok(comparisonService.getResults(id));
    }

    @GetMapping("/{id}/ranking")
    @Operation(summary = "Ranking of eligible quotations")
    public ResponseEntity<List<VendorComparisonResponse>> ranking(@PathVariable UUID id) {
        return ResponseEntity.ok(comparisonService.getRanking(id));
    }

    @PostMapping("/{id}/complete")
    @PreAuthorize("hasAnyRole('ADMIN','PROCUREMENT_ADMIN')")
    @Operation(summary = "Complete the comparison and send it to the Recommendation Service")
    public ResponseEntity<ComparisonResponse> complete(@PathVariable UUID id) {
        return ResponseEntity.ok(comparisonService.complete(id));
    }
}
