
package com.vqms.service.impl;

import com.vqms.notification.NotificationType;
import com.vqms.notification.Notifier;
import com.vqms.notification.Notifier.Recipients;
import com.vqms.repository.UserRepository;

import com.vqms.dto.request.ProcurementItemRequest;
import com.vqms.dto.request.ProcurementRequestRequest;
import com.vqms.dto.response.ProcurementItemResponse;
import com.vqms.dto.response.ProcurementRequestResponse;
import com.vqms.entity.ProcurementItem;
import com.vqms.entity.ProcurementRequest;
import com.vqms.entity.ProcurementStatus;
import com.vqms.exception.BadRequestException;
import com.vqms.mapper.ProcurementItemMapper;
import com.vqms.mapper.ProcurementRequestMapper;
import com.vqms.repository.ProcurementItemRepository;
import com.vqms.repository.ProcurementRequestRepository;
import com.vqms.service.ProcurementRequestService;

import jakarta.persistence.EntityNotFoundException;

import lombok.RequiredArgsConstructor;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class ProcurementRequestServiceImpl
        implements ProcurementRequestService {

    private final ProcurementRequestRepository procurementRequestRepository;
    private final ProcurementItemRepository procurementItemRepository;
    private final ProcurementRequestMapper procurementRequestMapper;
    private final ProcurementItemMapper procurementItemMapper;
    private final UserRepository userRepository;
    private final Notifier notifier;

    // --------------------------------------------------
    // CREATE PROCUREMENT REQUEST
    // --------------------------------------------------

    @Override
    public ProcurementRequestResponse createRequest(
            ProcurementRequestRequest request,
            UUID requesterId) {

        if (requesterId == null) {
            throw new BadRequestException("Requester ID is required");
        }

        ProcurementRequest procurementRequest =
                procurementRequestMapper.toEntity(request, requesterId);

        procurementRequest.setStatus(ProcurementStatus.DRAFT);

        ProcurementRequest savedRequest =
                procurementRequestRepository.save(procurementRequest);

        return procurementRequestMapper.toResponse(savedRequest);
    }

    // --------------------------------------------------
    // GET PROCUREMENT REQUEST BY ID
    // --------------------------------------------------

    @Override
    @Transactional(readOnly = true)
    public ProcurementRequestResponse getRequestById(
            UUID requestId,
            UUID currentUserId,
            boolean procurementAdmin) {

        ProcurementRequest request = findRequestById(requestId);

        validateAccess(request, currentUserId, procurementAdmin);

        return procurementRequestMapper.toResponse(request);
    }

    // --------------------------------------------------
    // GET ALL PROCUREMENT REQUESTS
    // --------------------------------------------------

    @Override
    @Transactional(readOnly = true)
    public Page<ProcurementRequestResponse> getAllRequests(
            Pageable pageable) {

        return procurementRequestRepository.findAll(pageable)
                .map(procurementRequestMapper::toResponse);
    }

    // --------------------------------------------------
    // GET REQUESTS CREATED BY CURRENT EMPLOYEE
    // --------------------------------------------------

    @Override
    @Transactional(readOnly = true)
    public Page<ProcurementRequestResponse> getMyRequests(
            UUID requesterId,
            Pageable pageable) {

        validateUserId(requesterId);

        return procurementRequestRepository
                .findByRequesterId(requesterId, pageable)
                .map(procurementRequestMapper::toResponse);
    }

    // --------------------------------------------------
    // SEARCH ALL PROCUREMENT REQUESTS
    // --------------------------------------------------

    @Override
    @Transactional(readOnly = true)
    public Page<ProcurementRequestResponse> searchRequests(
            String keyword,
            Pageable pageable) {

        validateKeyword(keyword);

        return procurementRequestRepository
                .searchRequests(keyword.trim(), pageable)
                .map(procurementRequestMapper::toResponse);
    }

    // --------------------------------------------------
    // SEARCH CURRENT EMPLOYEE'S REQUESTS
    // --------------------------------------------------

    @Override
    @Transactional(readOnly = true)
    public Page<ProcurementRequestResponse> searchMyRequests(
            UUID requesterId,
            String keyword,
            Pageable pageable) {

        validateUserId(requesterId);
        validateKeyword(keyword);

        return procurementRequestRepository
                .searchRequestsByRequester(
                        requesterId,
                        keyword.trim(),
                        pageable
                )
                .map(procurementRequestMapper::toResponse);
    }

    // --------------------------------------------------
    // FILTER REQUESTS BY STATUS
    // --------------------------------------------------

    @Override
    @Transactional(readOnly = true)
    public Page<ProcurementRequestResponse> getRequestsByStatus(
            ProcurementStatus status,
            Pageable pageable) {

        validateStatus(status);

        return procurementRequestRepository
                .findByStatus(status, pageable)
                .map(procurementRequestMapper::toResponse);
    }

    // --------------------------------------------------
    // FILTER CURRENT EMPLOYEE'S REQUESTS BY STATUS
    // --------------------------------------------------

    @Override
    @Transactional(readOnly = true)
    public Page<ProcurementRequestResponse> getMyRequestsByStatus(
            UUID requesterId,
            ProcurementStatus status,
            Pageable pageable) {

        validateUserId(requesterId);
        validateStatus(status);

        return procurementRequestRepository
                .findByRequesterIdAndStatus(
                        requesterId,
                        status,
                        pageable
                )
                .map(procurementRequestMapper::toResponse);
    }

    // --------------------------------------------------
    // UPDATE PROCUREMENT REQUEST
    // --------------------------------------------------

    @Override
    public ProcurementRequestResponse updateRequest(
            UUID requestId,
            ProcurementRequestRequest request,
            UUID currentUserId,
            boolean procurementAdmin) {

        ProcurementRequest existingRequest = findRequestById(requestId);

        validateAccess(existingRequest, currentUserId, procurementAdmin);

        if (existingRequest.getStatus() != ProcurementStatus.DRAFT
                && existingRequest.getStatus() != ProcurementStatus.REJECTED) {

            throw new BadRequestException(
                    "Only draft or rejected requests can be updated"
            );
        }

        procurementRequestMapper.updateEntity(existingRequest, request);

        ProcurementRequest updatedRequest =
                procurementRequestRepository.save(existingRequest);

        return procurementRequestMapper.toResponse(updatedRequest);
    }

    // --------------------------------------------------
    // DELETE PROCUREMENT REQUEST
    // --------------------------------------------------

    @Override
    public void deleteRequest(
            UUID requestId,
            UUID currentUserId,
            boolean procurementAdmin) {

        ProcurementRequest request = findRequestById(requestId);

        validateAccess(request, currentUserId, procurementAdmin);

        if (request.getStatus() != ProcurementStatus.DRAFT) {
            throw new BadRequestException(
                    "Only draft procurement requests can be deleted"
            );
        }

        procurementRequestRepository.delete(request);
    }

    // --------------------------------------------------
    // SUBMIT PROCUREMENT REQUEST
    // --------------------------------------------------

    @Override
    public ProcurementRequestResponse submitRequest(
            UUID requestId,
            UUID currentUserId) {

        validateUserId(currentUserId);

        ProcurementRequest request = findRequestById(requestId);

        if (!request.getRequesterId().equals(currentUserId)) {
            throw new BadRequestException(
                    "You can submit only your own procurement requests"
            );
        }

        if (request.getStatus() != ProcurementStatus.DRAFT
                && request.getStatus() != ProcurementStatus.REJECTED) {

            throw new BadRequestException(
                    "Only draft or rejected requests can be submitted"
            );
        }

        request.setStatus(ProcurementStatus.SUBMITTED);
        request.setSubmittedAt(LocalDateTime.now());

        // Clear previous rejection details on resubmission
        request.setApproverId(null);
        request.setRejectionReason(null);
        request.setApprovalComment(null);
        request.setRejectedAt(null);

        ProcurementRequest submittedRequest =
                procurementRequestRepository.save(request);

        String requester = userRepository.findById(currentUserId)
                .map(user -> user.getFullName() != null && !user.getFullName().isBlank() ? user.getFullName() : user.getUsername())
                .orElse("a colleague");
        notifier.notify(Recipients.roles("PROCUREMENT_ADMIN", "ADMIN").except(currentUserId),
                NotificationType.REQUEST_SUBMITTED, "Request awaiting approval",
                "\"" + request.getTitle() + "\" was submitted by " + requester + " and is waiting for your decision.",
                Notifier.PROCUREMENT_REQUEST, request.getId());

        return procurementRequestMapper.toResponse(submittedRequest);
    }

    // --------------------------------------------------
    // APPROVE PROCUREMENT REQUEST
    // --------------------------------------------------

    @Override
    public ProcurementRequestResponse approveRequest(
            UUID requestId,
            UUID approverId,
            String approvalComment) {

        validateUserId(approverId);

        ProcurementRequest request = findRequestById(requestId);

        if (request.getStatus() != ProcurementStatus.SUBMITTED) {
            throw new BadRequestException(
                    "Only submitted requests can be approved"
            );
        }

        if (request.getRequesterId().equals(approverId)) {
            throw new BadRequestException(
                    "Requester cannot approve their own procurement request"
            );
        }

        request.setStatus(ProcurementStatus.APPROVED);
        request.setApproverId(approverId);
        request.setApprovalComment(
                approvalComment == null || approvalComment.isBlank()
                        ? null
                        : approvalComment.trim()
        );
        request.setRejectionReason(null);
        request.setApprovedAt(LocalDateTime.now());

        ProcurementRequest approvedRequest =
                procurementRequestRepository.save(request);

        notifier.notify(Recipients.users(request.getRequesterId()).except(approverId),
                NotificationType.REQUEST_APPROVED, "Request approved",
                "Your request \"" + request.getTitle() + "\" was approved."
                        + (request.getApprovalComment() == null ? "" : " Comment: " + request.getApprovalComment()),
                Notifier.PROCUREMENT_REQUEST, request.getId());

        return procurementRequestMapper.toResponse(approvedRequest);
    }

    // --------------------------------------------------
    // REJECT PROCUREMENT REQUEST
    // --------------------------------------------------

    @Override
    public ProcurementRequestResponse rejectRequest(
            UUID requestId,
            UUID approverId,
            String rejectionReason) {

        validateUserId(approverId);

        if (rejectionReason == null || rejectionReason.isBlank()) {
            throw new BadRequestException(
                    "Rejection reason is required"
            );
        }

        if (rejectionReason.trim().length() > 5000) {
            throw new BadRequestException(
                    "Rejection reason cannot exceed 5000 characters"
            );
        }

        ProcurementRequest request = findRequestById(requestId);

        if (request.getStatus() != ProcurementStatus.SUBMITTED) {
            throw new BadRequestException(
                    "Only submitted requests can be rejected"
            );
        }

        if (request.getRequesterId().equals(approverId)) {
            throw new BadRequestException(
                    "Requester cannot reject their own procurement request"
            );
        }

        request.setStatus(ProcurementStatus.REJECTED);
        request.setApproverId(approverId);
        request.setRejectionReason(rejectionReason.trim());
        request.setApprovalComment(null);
        request.setRejectedAt(LocalDateTime.now());

        ProcurementRequest rejectedRequest =
                procurementRequestRepository.save(request);

        notifier.notify(Recipients.users(request.getRequesterId()).except(approverId),
                NotificationType.REQUEST_REJECTED, "Request rejected",
                "Your request \"" + request.getTitle() + "\" was rejected. Reason: " + request.getRejectionReason(),
                Notifier.PROCUREMENT_REQUEST, request.getId());

        return procurementRequestMapper.toResponse(rejectedRequest);
    }

    // --------------------------------------------------
    // CANCEL PROCUREMENT REQUEST
    // --------------------------------------------------

    @Override
    public ProcurementRequestResponse cancelRequest(
            UUID requestId,
            UUID currentUserId,
            boolean procurementAdmin) {

        ProcurementRequest request = findRequestById(requestId);

        validateAccess(request, currentUserId, procurementAdmin);

        if (request.getStatus() != ProcurementStatus.DRAFT
                && request.getStatus() != ProcurementStatus.SUBMITTED
                && request.getStatus() != ProcurementStatus.REJECTED) {

            throw new BadRequestException(
                    "This procurement request cannot be cancelled"
            );
        }

        request.setStatus(ProcurementStatus.CANCELLED);
        request.setCancelledAt(LocalDateTime.now());

        ProcurementRequest cancelledRequest =
                procurementRequestRepository.save(request);

        return procurementRequestMapper.toResponse(cancelledRequest);
    }

    // --------------------------------------------------
    // GET REQUESTS FOR APPROVER
    // --------------------------------------------------

    @Override
    @Transactional(readOnly = true)
    public Page<ProcurementRequestResponse> getRequestsForApprover(
            UUID approverId,
            Pageable pageable) {

        validateUserId(approverId);

        return procurementRequestRepository
                .findByApproverId(approverId, pageable)
                .map(procurementRequestMapper::toResponse);
    }

    // --------------------------------------------------
    // CHECK REQUEST OWNERSHIP
    // --------------------------------------------------

    @Override
    @Transactional(readOnly = true)
    public boolean isRequestOwner(
            UUID requestId,
            UUID requesterId) {

        validateUserId(requesterId);

        return procurementRequestRepository
                .existsByIdAndRequesterId(requestId, requesterId);
    }

    // --------------------------------------------------
    // CHECK REQUEST STATUS
    // --------------------------------------------------

    @Override
    @Transactional(readOnly = true)
    public boolean hasStatus(
            UUID requestId,
            ProcurementStatus status) {

        validateStatus(status);

        return procurementRequestRepository
                .existsByIdAndStatus(requestId, status);
    }

    // ==================================================
    // LINE ITEM MANAGEMENT
    // ==================================================

    @Override
    public ProcurementItemResponse addItem(
            UUID requestId,
            ProcurementItemRequest itemRequest,
            UUID currentUserId,
            boolean procurementAdmin) {

        ProcurementRequest request = findRequestById(requestId);
        validateAccess(request, currentUserId, procurementAdmin);

        if (request.getStatus() != ProcurementStatus.DRAFT
                && request.getStatus() != ProcurementStatus.REJECTED) {

            throw new BadRequestException(
                    "Items can only be added to draft or rejected requests"
            );
        }

        ProcurementItem item = procurementItemMapper.toEntity(itemRequest, request);
        ProcurementItem savedItem = procurementItemRepository.save(item);

        return procurementItemMapper.toResponse(savedItem);
    }

    @Override
    public ProcurementItemResponse updateItem(
            UUID requestId,
            UUID itemId,
            ProcurementItemRequest itemRequest,
            UUID currentUserId,
            boolean procurementAdmin) {

        ProcurementRequest request = findRequestById(requestId);
        validateAccess(request, currentUserId, procurementAdmin);

        if (request.getStatus() != ProcurementStatus.DRAFT
                && request.getStatus() != ProcurementStatus.REJECTED) {

            throw new BadRequestException(
                    "Items can only be updated in draft or rejected requests"
            );
        }

        ProcurementItem item = findItemByIdAndRequest(itemId, requestId);
        procurementItemMapper.updateEntity(item, itemRequest);
        ProcurementItem updatedItem = procurementItemRepository.save(item);

        return procurementItemMapper.toResponse(updatedItem);
    }

    @Override
    public void deleteItem(
            UUID requestId,
            UUID itemId,
            UUID currentUserId,
            boolean procurementAdmin) {

        ProcurementRequest request = findRequestById(requestId);
        validateAccess(request, currentUserId, procurementAdmin);

        if (request.getStatus() != ProcurementStatus.DRAFT
                && request.getStatus() != ProcurementStatus.REJECTED) {

            throw new BadRequestException(
                    "Items can only be deleted from draft or rejected requests"
            );
        }

        ProcurementItem item = findItemByIdAndRequest(itemId, requestId);
        procurementItemRepository.delete(item);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProcurementItemResponse> getItems(
            UUID requestId,
            UUID currentUserId,
            boolean procurementAdmin) {

        ProcurementRequest request = findRequestById(requestId);
        validateAccess(request, currentUserId, procurementAdmin);

        List<ProcurementItem> items =
                procurementItemRepository
                        .findByProcurementRequestIdOrderByCreatedAtAsc(requestId);

        return procurementItemMapper.toResponseList(items);
    }

    @Override
    @Transactional(readOnly = true)
    public ProcurementItemResponse getItem(
            UUID requestId,
            UUID itemId,
            UUID currentUserId,
            boolean procurementAdmin) {

        ProcurementRequest request = findRequestById(requestId);
        validateAccess(request, currentUserId, procurementAdmin);

        ProcurementItem item = findItemByIdAndRequest(itemId, requestId);
        return procurementItemMapper.toResponse(item);
    }

    // ==================================================
    // EXTENDED STATUS TRANSITIONS
    // ==================================================

    @Override
    public ProcurementRequestResponse requestQuotations(
            UUID requestId,
            UUID currentUserId,
            boolean procurementAdmin) {

        ProcurementRequest request = findRequestById(requestId);
        validateAccess(request, currentUserId, procurementAdmin);

        if (request.getStatus() != ProcurementStatus.APPROVED) {
            throw new BadRequestException(
                    "Only approved requests can transition to quotation requested"
            );
        }

        request.setStatus(ProcurementStatus.QUOTATION_REQUESTED);
        ProcurementRequest updatedRequest =
                procurementRequestRepository.save(request);

        String deadline = request.getRequiredBy() == null ? ""
                : " Needed by " + request.getRequiredBy().format(java.time.format.DateTimeFormatter.ofPattern("d MMM yyyy")) + ".";
        notifier.notify(Recipients.roles("VENDOR").except(currentUserId),
                NotificationType.QUOTATIONS_REQUESTED, "New request for quotation",
                "\"" + request.getTitle() + "\" is open for quotations." + deadline,
                Notifier.PROCUREMENT_REQUEST, request.getId());
        notifier.notify(Recipients.users(request.getRequesterId()).except(currentUserId),
                NotificationType.QUOTATIONS_REQUESTED, "Quotations requested",
                "Vendors have been invited to quote for your request \"" + request.getTitle() + "\".",
                Notifier.PROCUREMENT_REQUEST, request.getId());

        return procurementRequestMapper.toResponse(updatedRequest);
    }

    @Override
    public ProcurementRequestResponse startEvaluation(
            UUID requestId,
            UUID currentUserId,
            boolean procurementAdmin) {

        ProcurementRequest request = findRequestById(requestId);
        validateAccess(request, currentUserId, procurementAdmin);

        if (request.getStatus() != ProcurementStatus.QUOTATION_REQUESTED) {
            throw new BadRequestException(
                    "Only quotation requested requests can transition to under evaluation"
            );
        }

        request.setStatus(ProcurementStatus.UNDER_EVALUATION);
        ProcurementRequest updatedRequest =
                procurementRequestRepository.save(request);

        return procurementRequestMapper.toResponse(updatedRequest);
    }

    @Override
    public ProcurementRequestResponse completeRequest(
            UUID requestId,
            UUID currentUserId,
            boolean procurementAdmin) {

        ProcurementRequest request = findRequestById(requestId);
        validateAccess(request, currentUserId, procurementAdmin);

        if (request.getStatus() != ProcurementStatus.UNDER_EVALUATION) {
            throw new BadRequestException(
                    "Only under evaluation requests can be completed"
            );
        }

        request.setStatus(ProcurementStatus.COMPLETED);
        ProcurementRequest updatedRequest =
                procurementRequestRepository.save(request);

        notifier.notify(Recipients.users(request.getRequesterId()).except(currentUserId),
                NotificationType.REQUEST_COMPLETED, "Request completed",
                "Your request \"" + request.getTitle() + "\" has been completed.",
                Notifier.PROCUREMENT_REQUEST, request.getId());

        return procurementRequestMapper.toResponse(updatedRequest);
    }

    // ==================================================
    // PRIVATE HELPER METHODS
    // ==================================================

    private ProcurementRequest findRequestById(UUID requestId) {

        if (requestId == null) {
            throw new BadRequestException(
                    "Procurement request ID is required"
            );
        }

        return procurementRequestRepository.findById(requestId)
                .orElseThrow(() -> new EntityNotFoundException(
                        "Procurement request not found with ID: " + requestId
                ));
    }

    private ProcurementItem findItemByIdAndRequest(UUID itemId, UUID requestId) {

        if (itemId == null) {
            throw new BadRequestException(
                    "Item ID is required"
            );
        }

        return procurementItemRepository.findById(itemId)
                .filter(item -> item.getProcurementRequest() != null
                        && item.getProcurementRequest().getId().equals(requestId))
                .orElseThrow(() -> new EntityNotFoundException(
                        "Item not found with ID: " + itemId
                ));
    }

    private void validateAccess(
            ProcurementRequest request,
            UUID currentUserId,
            boolean procurementAdmin) {

        validateUserId(currentUserId);

        if (!procurementAdmin
                && !request.getRequesterId().equals(currentUserId)) {

            throw new AccessDeniedException(
                    "You are not authorized to access this procurement request"
            );
        }
    }

    private void validateUserId(UUID userId) {

        if (userId == null) {
            throw new BadRequestException(
                    "User ID is required"
            );
        }
    }

    private void validateKeyword(String keyword) {

        if (keyword == null || keyword.isBlank()) {
            throw new BadRequestException(
                    "Search keyword cannot be empty"
            );
        }

        if (keyword.trim().length() < 2) {
            throw new BadRequestException(
                    "Search keyword must contain at least 2 characters"
            );
        }
    }

    private void validateStatus(ProcurementStatus status) {

        if (status == null) {
            throw new BadRequestException(
                    "Procurement request status is required"
            );
        }
    }
}
