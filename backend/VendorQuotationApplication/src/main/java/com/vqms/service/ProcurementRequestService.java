
package com.vqms.service;

import com.vqms.dto.request.ProcurementItemRequest;
import com.vqms.dto.request.ProcurementRequestRequest;
import com.vqms.dto.response.ProcurementItemResponse;
import com.vqms.dto.response.ProcurementRequestResponse;
import com.vqms.entity.ProcurementStatus;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.UUID;

public interface ProcurementRequestService {

    // Create a new procurement request
    ProcurementRequestResponse createRequest(
            ProcurementRequestRequest request,
            UUID requesterId
    );

    // Retrieve a request by its ID
    ProcurementRequestResponse getRequestById(
            UUID requestId,
            UUID currentUserId,
            boolean procurementAdmin
    );

    // Retrieve all requests with pagination
    Page<ProcurementRequestResponse> getAllRequests(
            Pageable pageable
    );

    // Retrieve requests created by a particular employee
    Page<ProcurementRequestResponse> getMyRequests(
            UUID requesterId,
            Pageable pageable
    );

    // Search requests by title or description
    Page<ProcurementRequestResponse> searchRequests(
            String keyword,
            Pageable pageable
    );

    // Search within the current employee's requests
    Page<ProcurementRequestResponse> searchMyRequests(
            UUID requesterId,
            String keyword,
            Pageable pageable
    );

    // Filter requests by status
    Page<ProcurementRequestResponse> getRequestsByStatus(
            ProcurementStatus status,
            Pageable pageable
    );

    // Filter the current employee's requests by status
    Page<ProcurementRequestResponse> getMyRequestsByStatus(
            UUID requesterId,
            ProcurementStatus status,
            Pageable pageable
    );

    // Update an existing draft request
    ProcurementRequestResponse updateRequest(
            UUID requestId,
            ProcurementRequestRequest request,
            UUID currentUserId,
            boolean procurementAdmin
    );

    // Delete an eligible draft request
    void deleteRequest(
            UUID requestId,
            UUID currentUserId,
            boolean procurementAdmin
    );

    // Submit a draft request for approval
    ProcurementRequestResponse submitRequest(
            UUID requestId,
            UUID currentUserId
    );

    // Approve a submitted request
    ProcurementRequestResponse approveRequest(
            UUID requestId,
            UUID approverId,
            String approvalComment
    );

    // Reject a submitted request
    ProcurementRequestResponse rejectRequest(
            UUID requestId,
            UUID approverId,
            String rejectionReason
    );

    // Cancel an eligible request
    ProcurementRequestResponse cancelRequest(
            UUID requestId,
            UUID currentUserId,
            boolean procurementAdmin
    );

    // Retrieve requests assigned to an approver
    Page<ProcurementRequestResponse> getRequestsForApprover(
            UUID approverId,
            Pageable pageable
    );

    // Check whether a request belongs to an employee
    boolean isRequestOwner(
            UUID requestId,
            UUID requesterId
    );

    // Check the current status of a request
    boolean hasStatus(
            UUID requestId,
            ProcurementStatus status
    );

    // ==================================================
    // LINE ITEM MANAGEMENT
    // ==================================================

    // Add a line item to a procurement request
    ProcurementItemResponse addItem(
            UUID requestId,
            ProcurementItemRequest itemRequest,
            UUID currentUserId,
            boolean procurementAdmin
    );

    // Update a line item
    ProcurementItemResponse updateItem(
            UUID requestId,
            UUID itemId,
            ProcurementItemRequest itemRequest,
            UUID currentUserId,
            boolean procurementAdmin
    );

    // Delete a line item
    void deleteItem(
            UUID requestId,
            UUID itemId,
            UUID currentUserId,
            boolean procurementAdmin
    );

    // Get all items for a procurement request
    List<ProcurementItemResponse> getItems(
            UUID requestId,
            UUID currentUserId,
            boolean procurementAdmin
    );

    // Get a single item
    ProcurementItemResponse getItem(
            UUID requestId,
            UUID itemId,
            UUID currentUserId,
            boolean procurementAdmin
    );

    // ==================================================
    // EXTENDED STATUS TRANSITIONS
    // ==================================================

    // Transition from APPROVED to QUOTATION_REQUESTED
    ProcurementRequestResponse requestQuotations(
            UUID requestId,
            UUID currentUserId,
            boolean procurementAdmin
    );

    // Transition from QUOTATION_REQUESTED to UNDER_EVALUATION
    ProcurementRequestResponse startEvaluation(
            UUID requestId,
            UUID currentUserId,
            boolean procurementAdmin
    );

    // Transition from UNDER_EVALUATION to COMPLETED
    ProcurementRequestResponse completeRequest(
            UUID requestId,
            UUID currentUserId,
            boolean procurementAdmin
    );
}
