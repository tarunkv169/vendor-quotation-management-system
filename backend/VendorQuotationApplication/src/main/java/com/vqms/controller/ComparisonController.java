package com.vqms.controller;

import com.vqms.dto.response.ComparisonResponse;
import com.vqms.service.ComparisonService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/comparisons")
@RequiredArgsConstructor
public class ComparisonController {

    private final ComparisonService comparisonService;

    @PostMapping("/generate/{requestId}")
    public ResponseEntity<ComparisonResponse> generateComparison(
            @PathVariable UUID requestId,
            @RequestHeader(value = "X-User-Id", required = false) UUID userId) {
        ComparisonResponse response = comparisonService.generateComparison(
                requestId, userId != null ? userId : UUID.randomUUID());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ComparisonResponse> getComparison(@PathVariable UUID id) {
        return ResponseEntity.ok(comparisonService.getComparisonById(id));
    }

    @GetMapping("/request/{requestId}")
    public ResponseEntity<Page<ComparisonResponse>> getComparisonsByRequest(
            @PathVariable UUID requestId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ResponseEntity.ok(comparisonService.getComparisonsByRequestId(requestId, pageable));
    }

    @GetMapping("/request/{requestId}/all")
    public ResponseEntity<List<ComparisonResponse>> getAllComparisons(@PathVariable UUID requestId) {
        return ResponseEntity.ok(comparisonService.getAllComparisonsForRequest(requestId));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteComparison(
            @PathVariable UUID id,
            @RequestHeader(value = "X-User-Id", required = false) UUID userId) {
        comparisonService.deleteComparison(id, userId != null ? userId : UUID.randomUUID());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/price-variance/{requestId}")
    public ResponseEntity<Map<String, Object>> getPriceVariance(@PathVariable UUID requestId) {
        return ResponseEntity.ok(comparisonService.getPriceVariance(requestId));
    }

    @GetMapping("/delivery/{requestId}")
    public ResponseEntity<Map<String, Object>> getDeliveryComparison(@PathVariable UUID requestId) {
        return ResponseEntity.ok(comparisonService.getDeliveryComparison(requestId));
    }

    @GetMapping("/missing-fields/{requestId}")
    public ResponseEntity<List<Map<String, Object>>> getMissingFields(@PathVariable UUID requestId) {
        return ResponseEntity.ok(comparisonService.getMissingFieldsReport(requestId));
    }
}
