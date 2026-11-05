
package com.vqms.controller;

import com.vqms.dto.request.ProcurementItemRequest;
import com.vqms.dto.request.ProcurementRequestRequest;
import com.vqms.dto.response.ProcurementItemResponse;
import com.vqms.dto.response.ProcurementRequestResponse;
import com.vqms.entity.ProcurementStatus;
import com.vqms.exception.BadRequestException;
import com.vqms.service.ProcurementRequestService;

import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;

import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/procurement-requests")
@RequiredArgsConstructor
public class ProcurementRequestController {

    private final ProcurementRequestService procurementRequestService;


    private static final Set<String> ALLOWED_SORT_FIELDS = Set.of(
            "title",
            "quantity",
            "status",
            "requiredBy",
            "submittedAt",
            "approvedAt",
            "rejectedAt",
            "createdAt",
            "updatedAt"
    );


    // ==================================================
    // CREATE PROCUREMENT REQUEST
    // ==================================================

    @PostMapping
    public ResponseEntity<ProcurementRequestResponse> createRequest(
            @Valid @RequestBody ProcurementRequestRequest request,
            Authentication authentication) {

        UUID requesterId = getCurrentUserId(authentication);

        ProcurementRequestResponse response =
                procurementRequestService.createRequest(request, requesterId);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(response);
    }

    // ==================================================
    // GET PROCUREMENT REQUEST BY ID
    // ==================================================

    @GetMapping("/{id}")
    public ResponseEntity<ProcurementRequestResponse> getRequestById(
            @PathVariable UUID id,
            Authentication authentication) {

        UUID currentUserId = getCurrentUserId(authentication);
        boolean admin = isProcurementAdmin(authentication);

        ProcurementRequestResponse response =
                procurementRequestService.getRequestById(
                        id,
                        currentUserId,
                        admin
                );

        return ResponseEntity.ok(response);
    }

    // ==================================================
    // GET ALL REQUESTS (ADMIN ONLY)
    // ==================================================

    @GetMapping
    public ResponseEntity<Page<ProcurementRequestResponse>> getAllRequests(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String direction,
            Authentication authentication) {

        requireProcurementAdmin(authentication);

        Pageable pageable = createPageable(page, size, sortBy, direction);

        return ResponseEntity.ok(
                procurementRequestService.getAllRequests(pageable)
        );
    }

    // ==================================================
    // GET MY REQUESTS
    // ==================================================

    @GetMapping("/my-requests")
    public ResponseEntity<Page<ProcurementRequestResponse>> getMyRequests(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String direction,
            Authentication authentication) {

        UUID requesterId = getCurrentUserId(authentication);

        Pageable pageable = createPageable(page, size, sortBy, direction);

        return ResponseEntity.ok(
                procurementRequestService.getMyRequests(requesterId, pageable)
        );
    }

    // ==================================================
    // SEARCH ALL REQUESTS (ADMIN ONLY)
    // ==================================================

    @GetMapping("/search")
    public ResponseEntity<Page<ProcurementRequestResponse>> searchRequests(
            @RequestParam String keyword,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String direction,
            Authentication authentication) {

        requireProcurementAdmin(authentication);

        Pageable pageable = createPageable(page, size, sortBy, direction);

        return ResponseEntity.ok(
                procurementRequestService.searchRequests(keyword, pageable)
        );
    }

    // ==================================================
    // SEARCH MY REQUESTS
    // ==================================================

    @GetMapping("/my-requests/search")
    public ResponseEntity<Page<ProcurementRequestResponse>> searchMyRequests(
            @RequestParam String keyword,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String direction,
            Authentication authentication) {

        UUID requesterId = getCurrentUserId(authentication);

        Pageable pageable = createPageable(page, size, sortBy, direction);

        return ResponseEntity.ok(
                procurementRequestService.searchMyRequests(
                        requesterId,
                        keyword,
                        pageable
                )
        );
    }

    // ==================================================
    // FILTER ALL REQUESTS BY STATUS (ADMIN ONLY)
    // ==================================================

    @GetMapping("/status/{status}")
    public ResponseEntity<Page<ProcurementRequestResponse>> getRequestsByStatus(
            @PathVariable ProcurementStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String direction,
            Authentication authentication) {

        requireProcurementAdmin(authentication);

        Pageable pageable = createPageable(page, size, sortBy, direction);

        return ResponseEntity.ok(
                procurementRequestService.getRequestsByStatus(status, pageable)
        );
    }

    // ==================================================
    // FILTER MY REQUESTS BY STATUS
    // ==================================================

    @GetMapping("/my-requests/status/{status}")
    public ResponseEntity<Page<ProcurementRequestResponse>>
    getMyRequestsByStatus(
            @PathVariable ProcurementStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String direction,
            Authentication authentication) {

        UUID requesterId = getCurrentUserId(authentication);

        Pageable pageable = createPageable(page, size, sortBy, direction);

        return ResponseEntity.ok(
                procurementRequestService.getMyRequestsByStatus(
                        requesterId,
                        status,
                        pageable
                )
        );
    }

    // ==================================================
    // UPDATE PROCUREMENT REQUEST
    // ==================================================

    @PutMapping("/{id}")
    public ResponseEntity<ProcurementRequestResponse> updateRequest(
            @PathVariable UUID id,
            @Valid @RequestBody ProcurementRequestRequest request,
            Authentication authentication) {

        UUID currentUserId = getCurrentUserId(authentication);
        boolean admin = isProcurementAdmin(authentication);

        ProcurementRequestResponse response =
                procurementRequestService.updateRequest(
                        id,
                        request,
                        currentUserId,
                        admin
                );

        return ResponseEntity.ok(response);
    }

    // ==================================================
    // DELETE PROCUREMENT REQUEST
    // ==================================================

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteRequest(
            @PathVariable UUID id,
            Authentication authentication) {

        UUID currentUserId = getCurrentUserId(authentication);
        boolean admin = isProcurementAdmin(authentication);

        procurementRequestService.deleteRequest(
                id,
                currentUserId,
                admin
        );

        return ResponseEntity.noContent().build();
    }

    // ==================================================
    // SUBMIT PROCUREMENT REQUEST
    // ==================================================

    @PatchMapping("/{id}/submit")
    public ResponseEntity<ProcurementRequestResponse> submitRequest(
            @PathVariable UUID id,
            Authentication authentication) {

        UUID currentUserId = getCurrentUserId(authentication);

        ProcurementRequestResponse response =
                procurementRequestService.submitRequest(
                        id,
                        currentUserId
                );

        return ResponseEntity.ok(response);
    }

    // ==================================================
    // APPROVE PROCUREMENT REQUEST (ADMIN ONLY)
    // ==================================================

    @PatchMapping("/{id}/approve")
    public ResponseEntity<ProcurementRequestResponse> approveRequest(
            @PathVariable UUID id,
            @RequestParam(required = false) String comment,
            Authentication authentication) {

        requireProcurementAdmin(authentication);

        UUID approverId = getCurrentUserId(authentication);

        ProcurementRequestResponse response =
                procurementRequestService.approveRequest(
                        id,
                        approverId,
                        comment
                );

        return ResponseEntity.ok(response);
    }

    // ==================================================
    // REJECT PROCUREMENT REQUEST (ADMIN ONLY)
    // ==================================================

    @PatchMapping("/{id}/reject")
    public ResponseEntity<ProcurementRequestResponse> rejectRequest(
            @PathVariable UUID id,
            @RequestParam String reason,
            Authentication authentication) {

        requireProcurementAdmin(authentication);

        UUID approverId = getCurrentUserId(authentication);

        ProcurementRequestResponse response =
                procurementRequestService.rejectRequest(
                        id,
                        approverId,
                        reason
                );

        return ResponseEntity.ok(response);
    }

    // ==================================================
    // CANCEL PROCUREMENT REQUEST
    // ==================================================

    @PatchMapping("/{id}/cancel")
    public ResponseEntity<ProcurementRequestResponse> cancelRequest(
            @PathVariable UUID id,
            Authentication authentication) {

        UUID currentUserId = getCurrentUserId(authentication);
        boolean admin = isProcurementAdmin(authentication);

        ProcurementRequestResponse response =
                procurementRequestService.cancelRequest(
                        id,
                        currentUserId,
                        admin
                );

        return ResponseEntity.ok(response);
    }

    // ==================================================
    // ADD LINE ITEM
    // ==================================================

    @PostMapping("/{id}/items")
    public ResponseEntity<ProcurementItemResponse> addItem(
            @PathVariable UUID id,
            @Valid @RequestBody ProcurementItemRequest itemRequest,
            Authentication authentication) {

        UUID currentUserId = getCurrentUserId(authentication);
        boolean admin = isProcurementAdmin(authentication);

        ProcurementItemResponse response =
                procurementRequestService.addItem(
                        id,
                        itemRequest,
                        currentUserId,
                        admin
                );

        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // ==================================================
    // GET ALL LINE ITEMS
    // ==================================================

    @GetMapping("/{id}/items")
    public ResponseEntity<List<ProcurementItemResponse>> getItems(
            @PathVariable UUID id,
            Authentication authentication) {

        UUID currentUserId = getCurrentUserId(authentication);
        boolean admin = isProcurementAdmin(authentication);

        List<ProcurementItemResponse> items =
                procurementRequestService.getItems(
                        id,
                        currentUserId,
                        admin
                );

        return ResponseEntity.ok(items);
    }

    // ==================================================
    // GET SINGLE LINE ITEM
    // ==================================================

    @GetMapping("/{id}/items/{itemId}")
    public ResponseEntity<ProcurementItemResponse> getItem(
            @PathVariable UUID id,
            @PathVariable UUID itemId,
            Authentication authentication) {

        UUID currentUserId = getCurrentUserId(authentication);
        boolean admin = isProcurementAdmin(authentication);

        ProcurementItemResponse response =
                procurementRequestService.getItem(
                        id,
                        itemId,
                        currentUserId,
                        admin
                );

        return ResponseEntity.ok(response);
    }

    // ==================================================
    // UPDATE LINE ITEM
    // ==================================================

    @PutMapping("/{id}/items/{itemId}")
    public ResponseEntity<ProcurementItemResponse> updateItem(
            @PathVariable UUID id,
            @PathVariable UUID itemId,
            @Valid @RequestBody ProcurementItemRequest itemRequest,
            Authentication authentication) {

        UUID currentUserId = getCurrentUserId(authentication);
        boolean admin = isProcurementAdmin(authentication);

        ProcurementItemResponse response =
                procurementRequestService.updateItem(
                        id,
                        itemId,
                        itemRequest,
                        currentUserId,
                        admin
                );

        return ResponseEntity.ok(response);
    }

    // ==================================================
    // DELETE LINE ITEM
    // ==================================================

    @DeleteMapping("/{id}/items/{itemId}")
    public ResponseEntity<Void> deleteItem(
            @PathVariable UUID id,
            @PathVariable UUID itemId,
            Authentication authentication) {

        UUID currentUserId = getCurrentUserId(authentication);
        boolean admin = isProcurementAdmin(authentication);

        procurementRequestService.deleteItem(
                id,
                itemId,
                currentUserId,
                admin
        );

        return ResponseEntity.noContent().build();
    }

    // ==================================================
    // REQUEST QUOTATIONS (APPROVED -> QUOTATION_REQUESTED)
    // ==================================================

    @PatchMapping("/{id}/request-quotations")
    public ResponseEntity<ProcurementRequestResponse> requestQuotations(
            @PathVariable UUID id,
            Authentication authentication) {

        UUID currentUserId = getCurrentUserId(authentication);
        boolean admin = isProcurementAdmin(authentication);

        ProcurementRequestResponse response =
                procurementRequestService.requestQuotations(
                        id,
                        currentUserId,
                        admin
                );

        return ResponseEntity.ok(response);
    }

    // ==================================================
    // START EVALUATION (QUOTATION_REQUESTED -> UNDER_EVALUATION)
    // ==================================================

    @PatchMapping("/{id}/start-evaluation")
    public ResponseEntity<ProcurementRequestResponse> startEvaluation(
            @PathVariable UUID id,
            Authentication authentication) {

        UUID currentUserId = getCurrentUserId(authentication);
        boolean admin = isProcurementAdmin(authentication);

        ProcurementRequestResponse response =
                procurementRequestService.startEvaluation(
                        id,
                        currentUserId,
                        admin
                );

        return ResponseEntity.ok(response);
    }

    // ==================================================
    // COMPLETE REQUEST (UNDER_EVALUATION -> COMPLETED)
    // ==================================================

    @PatchMapping("/{id}/complete")
    public ResponseEntity<ProcurementRequestResponse> completeRequest(
            @PathVariable UUID id,
            Authentication authentication) {

        UUID currentUserId = getCurrentUserId(authentication);
        boolean admin = isProcurementAdmin(authentication);

        ProcurementRequestResponse response =
                procurementRequestService.completeRequest(
                        id,
                        currentUserId,
                        admin
                );

        return ResponseEntity.ok(response);
    }

    // ==================================================
    // GET REQUESTS FOR CURRENT APPROVER (ADMIN ONLY)
    // ==================================================

    @GetMapping("/my-approvals")
    public ResponseEntity<Page<ProcurementRequestResponse>>
    getRequestsForApprover(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "submittedAt") String sortBy,
            @RequestParam(defaultValue = "asc") String direction,
            Authentication authentication) {

        requireProcurementAdmin(authentication);

        UUID approverId = getCurrentUserId(authentication);

        Pageable pageable = createPageable(page, size, sortBy, direction);

        return ResponseEntity.ok(
                procurementRequestService.getRequestsForApprover(
                        approverId,
                        pageable
                )
        );
    }

    // ==================================================
    // PRIVATE HELPER METHODS
    // ==================================================

    private Pageable createPageable(
            int page,
            int size,
            String sortBy,
            String direction) {

        if (page < 0) {
            throw new BadRequestException(
                    "Page number cannot be negative"
            );
        }

        if (size < 1 || size > 100) {
            throw new BadRequestException(
                    "Page size must be between 1 and 100"
            );
        }

        if (sortBy == null || !ALLOWED_SORT_FIELDS.contains(sortBy)) {
            throw new BadRequestException(
                    "Invalid sorting field: " + sortBy
            );
        }

        if (direction == null
                || (!direction.equalsIgnoreCase("asc")
                && !direction.equalsIgnoreCase("desc"))) {

            throw new BadRequestException(
                    "Sort direction must be either asc or desc"
            );
        }

        Sort.Direction sortDirection =
                direction.equalsIgnoreCase("asc")
                        ? Sort.Direction.ASC
                        : Sort.Direction.DESC;

        return PageRequest.of(
                page,
                size,
                Sort.by(sortDirection, sortBy)
        );
    }

    private UUID getCurrentUserId(Authentication authentication) {

        if (authentication == null || !authentication.isAuthenticated()) {
            throw new BadRequestException(
                    "User authentication is required"
            );
        }

        try {
            return UUID.fromString(authentication.getName());
        } catch (IllegalArgumentException exception) {
            throw new BadRequestException(
                    "Authenticated user ID must be a valid UUID"
            );
        }
    }

    private boolean isProcurementAdmin(Authentication authentication) {

        if (authentication == null) {
            return false;
        }

        return authentication.getAuthorities()
                .stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(authority ->
                        authority.equals("ROLE_PROCUREMENT_ADMIN")
                                || authority.equals("ROLE_ADMIN")
                );
    }

    private void requireProcurementAdmin(Authentication authentication) {

        if (!isProcurementAdmin(authentication)) {
            throw new BadRequestException(
                    "You do not have permission to perform this operation"
            );
        }
    }
}
