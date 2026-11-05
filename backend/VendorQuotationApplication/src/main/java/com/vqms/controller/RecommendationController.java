package com.vqms.controller;

import com.vqms.dto.request.RecommendationCriteriaRequest;
import com.vqms.dto.response.RecommendationResponse;
import com.vqms.service.RecommendationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/recommendations")
@RequiredArgsConstructor
public class RecommendationController {

    private final RecommendationService recommendationService;

    @PostMapping("/generate/{requestId}")
    public ResponseEntity<RecommendationResponse> generateRecommendation(
            @PathVariable UUID requestId,
            @RequestHeader(value = "X-User-Id", required = false) UUID userId) {
        RecommendationResponse response = recommendationService.generateRecommendation(
                requestId, userId != null ? userId : UUID.randomUUID());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/generate-with-criteria/{requestId}")
    public ResponseEntity<RecommendationResponse> generateRecommendationWithCriteria(
            @PathVariable UUID requestId,
            @RequestHeader(value = "X-User-Id", required = false) UUID userId,
            @Valid @RequestBody RecommendationCriteriaRequest criteria) {
        RecommendationResponse response = recommendationService.generateRecommendationWithCriteria(
                requestId, userId != null ? userId : UUID.randomUUID(), criteria);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<RecommendationResponse> getRecommendation(@PathVariable UUID id) {
        return ResponseEntity.ok(recommendationService.getRecommendationById(id));
    }

    @GetMapping("/latest/{requestId}")
    public ResponseEntity<RecommendationResponse> getLatest(@PathVariable UUID requestId) {
        return ResponseEntity.ok(recommendationService.getLatestRecommendation(requestId));
    }

    @GetMapping("/request/{requestId}")
    public ResponseEntity<Page<RecommendationResponse>> getRecommendations(
            @PathVariable UUID requestId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ResponseEntity.ok(recommendationService.getRecommendationsByRequestId(requestId, pageable));
    }

    @GetMapping("/request/{requestId}/all")
    public ResponseEntity<List<RecommendationResponse>> getAllRecommendations(@PathVariable UUID requestId) {
        return ResponseEntity.ok(recommendationService.getAllRecommendationsForRequest(requestId));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteRecommendation(
            @PathVariable UUID id,
            @RequestHeader(value = "X-User-Id", required = false) UUID userId) {
        recommendationService.deleteRecommendation(id, userId != null ? userId : UUID.randomUUID());
        return ResponseEntity.noContent().build();
    }
}
