package com.vqms.recommendation.controller;

import com.vqms.recommendation.constants.RecommendationConstants;
import com.vqms.recommendation.dto.request.RecommendationRequest;
import com.vqms.recommendation.dto.request.SubmitForApprovalRequest;
import com.vqms.recommendation.dto.response.PageResponse;
import com.vqms.recommendation.dto.response.RecommendationExplanationResponse;
import com.vqms.recommendation.dto.response.RecommendationResponse;
import com.vqms.recommendation.dto.response.RecommendedVendorResponse;
import com.vqms.recommendation.enums.RecommendationStatus;
import com.vqms.recommendation.service.RecommendationService;
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

/** Recommendation endpoints (staff only; vendors cannot see competitors' evaluations). */
@RestController
@RequestMapping(RecommendationConstants.API_BASE_PATH)
@PreAuthorize("hasAnyRole('ADMIN','PROCUREMENT_ADMIN','PROCUREMENT_MANAGER','EMPLOYEE','INTERNAL_SERVICE')")
@Tag(name = "Recommendations")
public class RecommendationController {

    private final RecommendationService recommendationService;

    public RecommendationController(RecommendationService recommendationService) {
        this.recommendationService = recommendationService;
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','PROCUREMENT_ADMIN','PROCUREMENT_MANAGER')")
    @Operation(summary = "Generate a recommendation for a completed comparison")
    public ResponseEntity<RecommendationResponse> generate(@Valid @RequestBody RecommendationRequest request) {
        RecommendationResponse response = recommendationService.generate(request);
        return ResponseEntity.created(ServletUriComponentsBuilder.fromCurrentContextPath()
                .path(RecommendationConstants.API_BASE_PATH + "/{id}").buildAndExpand(response.id()).toUri())
                .body(response);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a recommendation")
    public ResponseEntity<RecommendationResponse> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(recommendationService.getById(id));
    }

    @GetMapping
    @Operation(summary = "Search recommendations")
    public ResponseEntity<PageResponse<RecommendationResponse>> search(
            @RequestParam(required = false) RecommendationStatus status,
            @RequestParam(required = false) UUID procurementRequestId,
            @ParameterObject @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(recommendationService.search(status, procurementRequestId, pageable));
    }

    @GetMapping("/procurement-request/{id}")
    @Operation(summary = "Recommendation history of a procurement request")
    public ResponseEntity<PageResponse<RecommendationResponse>> byProcurementRequest(
            @PathVariable UUID id, @ParameterObject @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(recommendationService.search(null, id, pageable));
    }

    @PostMapping("/{id}/regenerate")
    @PreAuthorize("hasAnyRole('ADMIN','PROCUREMENT_ADMIN','PROCUREMENT_MANAGER')")
    @Operation(summary = "Regenerate (supersedes the current recommendation)")
    public ResponseEntity<RecommendationResponse> regenerate(@PathVariable UUID id) {
        return ResponseEntity.ok(recommendationService.regenerate(id));
    }

    @GetMapping("/{id}/ranking")
    @Operation(summary = "Ranking with scores and risk")
    public ResponseEntity<List<RecommendedVendorResponse>> ranking(@PathVariable UUID id) {
        return ResponseEntity.ok(recommendationService.getRanking(id));
    }

    @GetMapping("/{id}/explanation")
    @Operation(summary = "Explanation of the recommendation")
    public ResponseEntity<RecommendationExplanationResponse> explanation(@PathVariable UUID id) {
        return ResponseEntity.ok(recommendationService.getExplanation(id));
    }

    @PostMapping("/{id}/submit-for-approval")
    @PreAuthorize("hasAnyRole('ADMIN','PROCUREMENT_ADMIN')")
    @Operation(summary = "Submit to the Approval Service (does not approve anything)")
    public ResponseEntity<RecommendationResponse> submitForApproval(
            @PathVariable UUID id, @Valid @RequestBody(required = false) SubmitForApprovalRequest request) {
        return ResponseEntity.ok(recommendationService.submitForApproval(id, request));
    }
}
