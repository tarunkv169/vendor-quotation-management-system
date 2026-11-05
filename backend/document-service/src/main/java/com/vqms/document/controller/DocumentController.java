package com.vqms.document.controller;

import com.vqms.document.constants.DocumentConstants;
import com.vqms.document.dto.request.DocumentSearchRequest;
import com.vqms.document.dto.request.DocumentStatusUpdateRequest;
import com.vqms.document.dto.request.DocumentUploadRequest;
import com.vqms.document.dto.response.DocumentDownloadResponse;
import com.vqms.document.dto.response.DocumentResponse;
import com.vqms.document.dto.response.DocumentStatusHistoryResponse;
import com.vqms.document.dto.response.PageResponse;
import com.vqms.document.service.DocumentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.List;
import java.util.UUID;

/**
 * REST endpoints for documents. Thin by design: validation of input shape happens here,
 * authorization and business rules in {@link DocumentService}.
 * {@code @PreAuthorize} adds a coarse role gate before the service-level ownership checks.
 */
@RestController
@RequestMapping(DocumentConstants.API_BASE_PATH)
@Tag(name = "Documents", description = "Document upload, retrieval and lifecycle")
public class DocumentController {

    private final DocumentService documentService;

    public DocumentController(DocumentService documentService) {
        this.documentService = documentService;
    }

    /**
     * multipart/form-data: part "file" + form fields bound to {@link DocumentUploadRequest}
     * via {@code @ModelAttribute}. Returns 201 with a Location header.
     */
    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('VENDOR','ADMIN','PROCUREMENT_ADMIN')")
    @Operation(summary = "Upload a document")
    public ResponseEntity<DocumentResponse> upload(@RequestPart("file") MultipartFile file,
                                                   @Valid @ModelAttribute DocumentUploadRequest request) {
        DocumentResponse response = documentService.upload(file, request);
        URI location = ServletUriComponentsBuilder.fromCurrentContextPath()
                .path(DocumentConstants.API_BASE_PATH + "/{id}")
                .buildAndExpand(response.id())
                .toUri();
        return ResponseEntity.created(location).body(response);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get document metadata")
    public ResponseEntity<DocumentResponse> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(documentService.getById(id));
    }

    @GetMapping
    @Operation(summary = "Search documents (vendors only see their own)")
    public ResponseEntity<PageResponse<DocumentResponse>> search(
            @ParameterObject @ModelAttribute DocumentSearchRequest criteria,
            @ParameterObject @PageableDefault(size = 20, sort ="createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(documentService.search(criteria, pageable));
    }

    /** Returns a short-lived presigned URL; the response must not be cached. */
    @GetMapping("/{id}/download")
    @Operation(summary = "Get a short-lived download link")
    public ResponseEntity<DocumentDownloadResponse> download(@PathVariable UUID id) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(documentService.createDownloadLink(id));
    }

    @GetMapping("/{id}/history")
    @Operation(summary = "Get document status history")
    public ResponseEntity<List<DocumentStatusHistoryResponse>> history(@PathVariable UUID id) {
        return ResponseEntity.ok(documentService.getStatusHistory(id));
    }

    @GetMapping("/quotation/{quotationId}")
    @Operation(summary = "List documents of a quotation")
    public ResponseEntity<PageResponse<DocumentResponse>> byQuotation(
            @PathVariable UUID quotationId,
            @ParameterObject @PageableDefault(size = 20, sort ="createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(documentService.getByQuotation(quotationId, pageable));
    }

    @GetMapping("/vendor/{vendorId}")
    @Operation(summary = "List documents of a vendor")
    public ResponseEntity<PageResponse<DocumentResponse>> byVendor(
            @PathVariable UUID vendorId,
            @ParameterObject @PageableDefault(size = 20, sort ="createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(documentService.getByVendor(vendorId, pageable));
    }

    @GetMapping("/procurement-request/{requestId}")
    @Operation(summary = "List documents of a procurement request")
    public ResponseEntity<PageResponse<DocumentResponse>> byProcurementRequest(
            @PathVariable UUID requestId,
            @ParameterObject @PageableDefault(size = 20, sort ="createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(documentService.getByProcurementRequest(requestId, pageable));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('VENDOR','ADMIN','PROCUREMENT_ADMIN')")
    @Operation(summary = "Soft delete a document")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        documentService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN','PROCUREMENT_ADMIN','INTERNAL_SERVICE')")
    @Operation(summary = "Change document status")
    public ResponseEntity<DocumentResponse> updateStatus(@PathVariable UUID id,
                                                         @Valid @RequestBody DocumentStatusUpdateRequest request) {
        return ResponseEntity.ok(documentService.updateStatus(id, request));
    }
}
