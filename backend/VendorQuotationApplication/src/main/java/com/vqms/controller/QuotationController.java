package com.vqms.controller;

import com.vqms.dto.request.QuotationItemRequest;
import com.vqms.dto.request.QuotationRequest;
import com.vqms.dto.response.QuotationItemResponse;
import com.vqms.dto.response.QuotationResponse;
import com.vqms.service.QuotationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/quotations")
@RequiredArgsConstructor
public class QuotationController {

    private final QuotationService quotationService;

    // ==================================================
    // QUOTATION CRUD
    // ==================================================

    @PostMapping("/manual")
    public ResponseEntity<QuotationResponse> createQuotation(
            @Valid @RequestBody QuotationRequest request) {
        QuotationResponse response = quotationService.createQuotation(
                request.getPurchaseRequestId(), request, UUID.randomUUID());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/{requestId}/upload")
    public ResponseEntity<QuotationResponse> uploadQuotation(
            @PathVariable UUID requestId,
            @RequestParam UUID vendorId,
            @RequestParam("file") MultipartFile file) {
        QuotationResponse response = quotationService.uploadQuotation(
                requestId, vendorId, file, UUID.randomUUID());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<List<QuotationResponse>> getAllQuotations() {
        return ResponseEntity.ok(quotationService.getAllQuotations());
    }

    @GetMapping("/{id}")
    public ResponseEntity<QuotationResponse> getQuotation(@PathVariable UUID id) {
        return ResponseEntity.ok(quotationService.getQuotationById(id));
    }

    @GetMapping("/request/{requestId}")
    public ResponseEntity<Page<QuotationResponse>> getQuotationsByRequest(
            @PathVariable UUID requestId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ResponseEntity.ok(quotationService.getQuotationsByRequestId(requestId, pageable));
    }

    @GetMapping("/vendor/{vendorId}")
    public ResponseEntity<Page<QuotationResponse>> getQuotationsByVendor(
            @PathVariable UUID vendorId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ResponseEntity.ok(quotationService.getQuotationsByVendorId(vendorId, pageable));
    }

    @PutMapping("/{id}")
    public ResponseEntity<QuotationResponse> updateQuotation(
            @PathVariable UUID id,
            @Valid @RequestBody QuotationRequest request) {
        return ResponseEntity.ok(quotationService.updateQuotation(id, request, UUID.randomUUID()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteQuotation(@PathVariable UUID id) {
        quotationService.deleteQuotation(id, UUID.randomUUID());
        return ResponseEntity.noContent().build();
    }

    // ==================================================
    // QUOTATION WORKFLOW
    // ==================================================

    @PostMapping("/{id}/process")
    public ResponseEntity<QuotationResponse> processQuotation(@PathVariable UUID id) {
        return ResponseEntity.ok(quotationService.processQuotation(id));
    }

    @PostMapping("/{id}/review")
    public ResponseEntity<QuotationResponse> reviewQuotation(@PathVariable UUID id) {
        return ResponseEntity.ok(quotationService.reviewQuotation(id, UUID.randomUUID()));
    }

    @PostMapping("/{id}/submit")
    public ResponseEntity<QuotationResponse> submitQuotation(@PathVariable UUID id) {
        return ResponseEntity.ok(quotationService.submitQuotation(id, UUID.randomUUID()));
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<QuotationResponse> cancelQuotation(@PathVariable UUID id) {
        return ResponseEntity.ok(quotationService.cancelQuotation(id, UUID.randomUUID()));
    }

    @PostMapping("/{id}/retry")
    public ResponseEntity<QuotationResponse> retryProcessing(@PathVariable UUID id) {
        return ResponseEntity.ok(quotationService.retryProcessing(id));
    }

    @PostMapping("/{id}/version")
    public ResponseEntity<QuotationResponse> createNewVersion(
            @PathVariable UUID id,
            @Valid @RequestBody QuotationRequest request) {
        QuotationResponse response = quotationService.createNewVersion(id, request, UUID.randomUUID());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // ==================================================
    // QUOTATION ITEM MANAGEMENT
    // ==================================================

    @GetMapping("/{id}/items")
    public ResponseEntity<List<QuotationItemResponse>> getItems(@PathVariable UUID id) {
        return ResponseEntity.ok(quotationService.getItems(id));
    }

    @PostMapping("/{id}/items")
    public ResponseEntity<QuotationItemResponse> addItem(
            @PathVariable UUID id,
            @Valid @RequestBody QuotationItemRequest itemRequest) {
        QuotationItemResponse response = quotationService.addItem(id, itemRequest, UUID.randomUUID());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PutMapping("/{quotationId}/items/{itemId}")
    public ResponseEntity<QuotationItemResponse> updateItem(
            @PathVariable UUID quotationId,
            @PathVariable UUID itemId,
            @Valid @RequestBody QuotationItemRequest itemRequest) {
        return ResponseEntity.ok(quotationService.updateItem(quotationId, itemId, itemRequest, UUID.randomUUID()));
    }

    @DeleteMapping("/{quotationId}/items/{itemId}")
    public ResponseEntity<Void> deleteItem(
            @PathVariable UUID quotationId,
            @PathVariable UUID itemId) {
        quotationService.deleteItem(quotationId, itemId, UUID.randomUUID());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{quotationId}/items/{itemId}/verify")
    public ResponseEntity<QuotationItemResponse> verifyItem(
            @PathVariable UUID quotationId,
            @PathVariable UUID itemId) {
        return ResponseEntity.ok(quotationService.verifyItem(quotationId, itemId, UUID.randomUUID()));
    }
}
